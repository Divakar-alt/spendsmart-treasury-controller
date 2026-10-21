import { v4 as uuidv4 } from 'uuid';
import {
  WalletBalance,
  BalanceResponse,
  GlobalAccount,
  FxRate,
  FxQuote,
  FxQuoteRequest,
  FxConversion,
  FxConversionRequest,
  Beneficiary,
  Transfer,
  TransferRequest,
  DepositSimulationRequest,
  DepositSimulationResponse,
  TransferStatus,
} from '../types/airwallex';

export interface AirwallexClientConfig {
  clientId?: string;
  apiKey?: string;
  baseUrl?: string;
}

export class AirwallexSandboxClient {
  private clientId: string;
  private apiKey: string;
  private baseUrl: string;
  private bearerToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private usedRequestIds: Set<string> = new Set();

  constructor(config: AirwallexClientConfig = {}) {
    this.clientId = config.clientId || process.env.AWX_CLIENT_ID || '';
    this.apiKey = config.apiKey || process.env.AWX_API_KEY || '';
    this.baseUrl = (config.baseUrl || process.env.AIRWALLEX_API_URL || 'https://api.sandbox.airwallex.com').replace(/\/$/, '');
  }

  public isConfigured(): boolean {
    return Boolean(this.clientId && this.apiKey);
  }

  /**
   * Track request ID to prevent duplicate reuse within 7 days
   */
  private registerRequestId(requestId: string): void {
    if (this.usedRequestIds.has(requestId)) {
      throw new Error(`Airwallex error [duplicate_request_id]: Request ID ${requestId} was already submitted.`);
    }
    this.usedRequestIds.add(requestId);
  }

  /**
   * Authenticate with Airwallex Sandbox API
   * POST /api/v1/authentication/login with x-client-id and x-api-key headers
   */
  private async getAuthToken(): Promise<string> {
    const now = Date.now();
    if (this.bearerToken && this.tokenExpiresAt > now + 60000) {
      return this.bearerToken;
    }

    if (!this.clientId || !this.apiKey) {
      throw new Error('Airwallex client ID or API key missing in environment configuration.');
    }

    const response = await fetch(`${this.baseUrl}/api/v1/authentication/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': this.clientId,
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Airwallex authentication failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    this.bearerToken = data.token;
    // Token is valid for 30 minutes; refresh at 25 minutes
    this.tokenExpiresAt = now + (data.expires_in ? data.expires_in * 1000 : 25 * 60 * 1000);
    return this.bearerToken!;
  }

  /**
   * Generic authenticated fetch helper
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      omitApiVersion?: boolean;
    } = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };

    // Notice per guide: Leave x-api-version off FX calls!
    if (options.omitApiVersion) {
      delete headers['x-api-version'];
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr: any;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        parsedErr = { message: errText };
      }
      throw new Error(`Airwallex API error [${response.status}] ${endpoint}: ${parsedErr.code || parsedErr.message || errText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * List Global Accounts
   * GET /api/v1/global_accounts
   */
  async listGlobalAccounts(): Promise<GlobalAccount[]> {
    const res = await this.request<{ items: GlobalAccount[] }>('/api/v1/global_accounts');
    return res.items || [];
  }

  /**
   * Create Global Account if none exist
   * POST /api/v1/global_accounts/create
   */
  async createGlobalAccount(countryCode: string = 'US', currency: string = 'USD'): Promise<GlobalAccount> {
    const reqId = uuidv4();
    this.registerRequestId(reqId);
    return this.request<GlobalAccount>('/api/v1/global_accounts/create', {
      method: 'POST',
      body: {
        request_id: reqId,
        country_code: countryCode,
        required_features: [{ currency, transfer_method: 'LOCAL' }],
      },
    });
  }

  /**
   * Get Current Wallet Balances
   * GET /api/v1/balances/current (amounts are in major units!)
   */
  async getCurrentBalances(): Promise<WalletBalance[]> {
    const res = await this.request<BalanceResponse>('/api/v1/balances/current');
    return res.items || [];
  }

  /**
   * Get Live FX Rates
   * GET /api/v1/fx/rates/current
   * Note: Leave x-api-version off FX calls
   */
  async getFxRates(): Promise<FxRate[]> {
    const res = await this.request<{ items: FxRate[] }>('/api/v1/fx/rates/current', {
      omitApiVersion: true,
    });
    return res.items || [];
  }

  /**
   * Create FX Quote
   * POST /api/v1/fx/quotes/create
   */
  async createFxQuote(quoteReq: FxQuoteRequest): Promise<FxQuote> {
    this.registerRequestId(quoteReq.request_id);
    return this.request<FxQuote>('/api/v1/fx/quotes/create', {
      method: 'POST',
      body: quoteReq,
      omitApiVersion: true,
    });
  }

  /**
   * Book an FX Conversion
   * POST /api/v1/fx/conversions/create
   * Note: Book over REST because no MCP tool exists. Immediate SETTLED.
   */
  async createFxConversion(convReq: FxConversionRequest): Promise<FxConversion> {
    this.registerRequestId(convReq.request_id);
    return this.request<FxConversion>('/api/v1/fx/conversions/create', {
      method: 'POST',
      body: convReq,
      omitApiVersion: true,
    });
  }

  /**
   * Create Beneficiary
   * POST /api/v1/beneficiaries/create
   */
  async createBeneficiary(beneficiaryPayload: Partial<Beneficiary>): Promise<Beneficiary> {
    return this.request<Beneficiary>('/api/v1/beneficiaries/create', {
      method: 'POST',
      body: beneficiaryPayload,
    });
  }

  /**
   * Create Transfer
   * POST /api/v1/transfers/create
   * Note: Send transfer_currency and transfer_amount (amounts in major units)
   */
  async createTransfer(transferReq: TransferRequest): Promise<Transfer> {
    this.registerRequestId(transferReq.request_id);
    return this.request<Transfer>('/api/v1/transfers/create', {
      method: 'POST',
      body: {
        request_id: transferReq.request_id,
        beneficiary_id: transferReq.beneficiary_id,
        transfer_amount: transferReq.transfer_amount,
        transfer_currency: transferReq.transfer_currency,
        transfer_method: transferReq.transfer_method,
        reference: transferReq.reference,
        reason: transferReq.reason || 'payment_for_goods_or_services',
      },
    });
  }

  /**
   * Get Transfer by ID
   * GET /api/v1/transfers/{id}
   */
  async getTransfer(transferId: string): Promise<Transfer> {
    return this.request<Transfer>(`/api/v1/transfers/${transferId}`);
  }

  /**
   * Simulate Transfer Transition
   * POST /api/v1/simulation/transfers/{id}/transition
   * Allowed statuses: SENT, PAID, CANCELLED
   */
  async transitionTransfer(transferId: string, status: 'SENT' | 'PAID' | 'CANCELLED', failureType?: string): Promise<Transfer> {
    return this.request<Transfer>(`/api/v1/simulation/transfers/${transferId}/transition`, {
      method: 'POST',
      body: {
        status,
        failure_type: failureType,
      },
    });
  }

  /**
   * Simulate Inbound Deposit into Global Account
   * POST /api/v1/simulation/deposit/create
   * Although returns PENDING, balance reflects immediately in Sandbox
   */
  async simulateDeposit(depositReq: DepositSimulationRequest): Promise<DepositSimulationResponse> {
    return this.request<DepositSimulationResponse>('/api/v1/simulation/deposit/create', {
      method: 'POST',
      body: {
        global_account_id: depositReq.global_account_id,
        amount: depositReq.amount,
        payer_name: depositReq.payer_name || 'Simulated Deposit',
      },
    });
  }
}
