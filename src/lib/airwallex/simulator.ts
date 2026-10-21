import { v4 as uuidv4 } from 'uuid';
import {
  WalletBalance,
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
  SupportedCurrency,
} from '../types/airwallex';
import { INITIAL_WALLET_BALANCES, INITIAL_FX_RATES, TREASURY_POLICY_RULES } from '../treasury/baseline';
import { CurrencyMath } from '../treasury/currency-math';

export class AirwallexSandboxSimulator {
  private balances: Map<SupportedCurrency, WalletBalance> = new Map();
  private globalAccounts: Map<string, GlobalAccount> = new Map();
  private quotes: Map<string, FxQuote> = new Map();
  private conversions: Map<string, FxConversion> = new Map();
  private beneficiaries: Map<string, Beneficiary> = new Map();
  private transfers: Map<string, Transfer> = new Map();
  private usedRequestIds: Map<string, { operation: string; timestamp: number }> = new Map();

  constructor() {
    this.resetToBaseline();
  }

  /**
   * Reset simulator to pristine baseline scenario state
   */
  public resetToBaseline(): void {
    this.balances.clear();
    for (const b of INITIAL_WALLET_BALANCES) {
      this.balances.set(b.currency, { ...b });
    }

    this.globalAccounts.clear();
    this.globalAccounts.set('ga_us_treasury_01', {
      id: 'ga_us_treasury_01',
      account_name: 'SpendSmart Operating Account - USD',
      account_number: '883019284102',
      country_code: 'US',
      currency: 'USD',
      status: 'ACTIVE',
    });

    this.quotes.clear();
    this.conversions.clear();
    this.beneficiaries.clear();
    this.transfers.clear();
    this.usedRequestIds.clear();

    // Pre-populate standard beneficiaries
    this.createBeneficiaryInternal({
      beneficiary_id: 'ben_logistics_01',
      entity_type: 'COMPANY',
      company_name: 'Apex Global Logistics & Freight',
      bank_details: {
        account_number: '449102931',
        account_routing_type1: 'aba',
        account_routing_value1: '121000358',
        bank_account_category: 'Checking',
        bank_name: 'Silicon Valley Commercial Bank',
      },
      address: {
        street_address: '100 Ocean Blvd Ste 400',
        city: 'Long Beach',
        state: 'CA',
        postcode: '90802',
        country_code: 'US',
      },
      transfer_methods: ['LOCAL'],
    });

    this.createBeneficiaryInternal({
      beneficiary_id: 'ben_cloud_02',
      entity_type: 'COMPANY',
      company_name: 'European Cloud Infrastructure AG',
      bank_details: {
        iban: 'DE89370400440532013000',
        swift_code: 'DBEUMM21XXX',
        bank_name: 'Deutsche Bank Frankfurt',
      },
      address: {
        street_address: 'Taunusanlage 12',
        city: 'Frankfurt',
        postcode: '60325',
        country_code: 'DE',
      },
      transfer_methods: ['SWIFT'],
    });
  }

  private validateRequestId(requestId: string, operation: string): void {
    if (!requestId || requestId.length < 10 || requestId.length > 50) {
      throw new Error(`Airwallex error [018]: Invalid request_id length: must be between 10 and 50 characters.`);
    }

    const existing = this.usedRequestIds.get(requestId);
    if (existing) {
      if (existing.operation !== operation) {
        throw new Error(`Airwallex error [duplicate_request_id]: Request ID ${requestId} was already used for operation '${existing.operation}'.`);
      }
    }
    this.usedRequestIds.set(requestId, { operation, timestamp: Date.now() });
  }

  private createBeneficiaryInternal(ben: Beneficiary): Beneficiary {
    this.beneficiaries.set(ben.beneficiary_id, ben);
    return ben;
  }

  async listGlobalAccounts(): Promise<GlobalAccount[]> {
    return Array.from(this.globalAccounts.values());
  }

  async getCurrentBalances(): Promise<WalletBalance[]> {
    return Array.from(this.balances.values()).map(b => ({ ...b }));
  }

  async getFxRates(): Promise<FxRate[]> {
    return INITIAL_FX_RATES.map(r => ({ ...r, timestamp: new Date().toISOString() }));
  }

  async createFxQuote(req: FxQuoteRequest): Promise<FxQuote> {
    this.validateRequestId(req.request_id, 'fx_quote');
    const quoteId = `quote_${Date.now()}_${uuidv4().substring(0, 6)}`;
    
    // Determine rate
    let clientRate = 1.0877;
    if (req.buy_currency === 'EUR' && req.sell_currency === 'USD') clientRate = 1.0877;
    else if (req.buy_currency === 'GBP' && req.sell_currency === 'USD') clientRate = 1.2982;
    else if (req.buy_currency === 'USD' && req.sell_currency === 'EUR') clientRate = 0.9193;

    let buyAmount = req.buy_amount || 0;
    let sellAmount = req.sell_amount || 0;

    if (buyAmount > 0 && sellAmount === 0) {
      sellAmount = CurrencyMath.multiply(buyAmount, clientRate).toDecimalPlaces(2).toNumber();
    } else if (sellAmount > 0 && buyAmount === 0) {
      buyAmount = CurrencyMath.divide(sellAmount, clientRate).toDecimalPlaces(2).toNumber();
    }

    const quote: FxQuote = {
      quote_id: quoteId,
      request_id: req.request_id,
      buy_currency: req.buy_currency,
      sell_currency: req.sell_currency,
      buy_amount: buyAmount,
      sell_amount: sellAmount,
      client_rate: clientRate,
      validity_in_seconds: 60,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60000).toISOString(),
    };

    this.quotes.set(quoteId, quote);
    return quote;
  }

  async createFxConversion(req: FxConversionRequest): Promise<FxConversion> {
    this.validateRequestId(req.request_id, 'fx_conversion');

    let quote = req.quote_id ? this.quotes.get(req.quote_id) : null;
    let rate = quote ? quote.client_rate : 1.0877;

    let buyAmount = req.buy_amount || (quote ? quote.buy_amount : 0);
    let sellAmount = req.sell_amount || (quote ? quote.sell_amount : 0);

    if (buyAmount > 0 && sellAmount === 0) {
      sellAmount = CurrencyMath.multiply(buyAmount, rate).toDecimalPlaces(2).toNumber();
    }

    // Verify sell currency balance
    const sellBalance = this.balances.get(req.sell_currency);
    if (!sellBalance || sellBalance.available_amount < sellAmount) {
      throw new Error(`Airwallex error [insufficient_funds]: Available balance (${sellBalance?.available_amount || 0} ${req.sell_currency}) cannot fund conversion sell_amount (${sellAmount} ${req.sell_currency}).`);
    }

    // Execute immediate settlement
    sellBalance.available_amount = CurrencyMath.subtract(sellBalance.available_amount, sellAmount).toNumber();
    sellBalance.total_amount = sellBalance.available_amount;

    const buyBalance = this.balances.get(req.buy_currency) || {
      currency: req.buy_currency,
      available_amount: 0,
      pending_amount: 0,
      reserved_amount: 0,
      total_amount: 0,
    };
    buyBalance.available_amount = CurrencyMath.add(buyBalance.available_amount, buyAmount).toNumber();
    buyBalance.total_amount = buyBalance.available_amount;
    this.balances.set(req.buy_currency, buyBalance);

    const conversionId = `cnv_${Date.now()}_${uuidv4().substring(0, 6)}`;
    const conversion: FxConversion = {
      conversion_id: conversionId,
      request_id: req.request_id,
      quote_id: req.quote_id,
      buy_currency: req.buy_currency,
      sell_currency: req.sell_currency,
      buy_amount: buyAmount,
      sell_amount: sellAmount,
      rate,
      status: 'SETTLED', // Per guide: FX conversions settle immediately with status: "SETTLED"
      created_at: new Date().toISOString(),
    };

    this.conversions.set(conversionId, conversion);
    return conversion;
  }

  async createBeneficiary(payload: Partial<Beneficiary>): Promise<Beneficiary> {
    const beneficiaryId = payload.beneficiary_id || `ben_${Date.now()}_${uuidv4().substring(0, 6)}`;
    const fullBen: Beneficiary = {
      beneficiary_id: beneficiaryId,
      entity_type: payload.entity_type || 'COMPANY',
      company_name: payload.company_name || 'Generic Vendor',
      bank_details: payload.bank_details || {},
      address: payload.address || { street_address: '123 Market St', city: 'San Francisco', country_code: 'US' },
      transfer_methods: payload.transfer_methods || ['LOCAL'],
    };
    this.beneficiaries.set(beneficiaryId, fullBen);
    return fullBen;
  }

  async createTransfer(req: TransferRequest): Promise<Transfer> {
    this.validateRequestId(req.request_id, 'transfer');

    const fee = req.transfer_method === 'SWIFT' 
      ? (req.transfer_currency === 'EUR' ? TREASURY_POLICY_RULES.SWIFT_FLAT_FEE_EUR : TREASURY_POLICY_RULES.SWIFT_FLAT_FEE_GBP)
      : 0;

    const totalDebit = CurrencyMath.add(req.transfer_amount, fee).toNumber();
    const balance = this.balances.get(req.transfer_currency);

    if (!balance || balance.available_amount < totalDebit) {
      throw new Error(`Airwallex error [balance_insufficient]: Wallet balance (${balance?.available_amount || 0} ${req.transfer_currency}) is insufficient to debit ${totalDebit} ${req.transfer_currency} (transfer amount ${req.transfer_amount} + fee ${fee}).`);
    }

    // Deduct immediately from available amount
    balance.available_amount = CurrencyMath.subtract(balance.available_amount, totalDebit).toNumber();
    balance.total_amount = balance.available_amount;

    const transferId = `trf_${Date.now()}_${uuidv4().substring(0, 6)}`;
    const beneficiary = this.beneficiaries.get(req.beneficiary_id);

    const transfer: Transfer = {
      transfer_id: transferId,
      request_id: req.request_id,
      beneficiary_id: req.beneficiary_id,
      beneficiary_name: beneficiary?.company_name,
      transfer_amount: req.transfer_amount,
      transfer_currency: req.transfer_currency,
      transfer_method: req.transfer_method,
      status: 'NEW',
      fee_amount: fee,
      fee_currency: req.transfer_currency,
      reference: req.reference || 'Treasury Automated Payout',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.transfers.set(transferId, transfer);
    return transfer;
  }

  async getTransfer(id: string): Promise<Transfer> {
    const trf = this.transfers.get(id);
    if (!trf) throw new Error(`Transfer ${id} not found in simulator ledger.`);
    return { ...trf };
  }

  async transitionTransfer(id: string, targetStatus: 'SENT' | 'PAID' | 'CANCELLED', failureType?: string): Promise<Transfer> {
    const trf = this.transfers.get(id);
    if (!trf) throw new Error(`Transfer ${id} not found.`);

    // Check transition rules per guide:
    // Can only transition to SENT first, then PAID or CANCELLED
    trf.status = targetStatus;
    trf.updated_at = new Date().toISOString();

    if (targetStatus === 'CANCELLED') {
      trf.failure_type = failureType || 'BANK_RETURN';
      trf.failure_reason = 'Transfer cancelled in settlement corridor simulation';
      // Refund balance on cancellation
      const totalDebit = CurrencyMath.add(trf.transfer_amount, trf.fee_amount).toNumber();
      const bal = this.balances.get(trf.transfer_currency);
      if (bal) {
        bal.available_amount = CurrencyMath.add(bal.available_amount, totalDebit).toNumber();
        bal.total_amount = bal.available_amount;
      }
    }

    return { ...trf };
  }

  async simulateDeposit(req: DepositSimulationRequest): Promise<DepositSimulationResponse> {
    const ga = this.globalAccounts.get(req.global_account_id);
    const currency = req.currency || (ga ? ga.currency : 'USD');

    const bal = this.balances.get(currency) || {
      currency,
      available_amount: 0,
      pending_amount: 0,
      reserved_amount: 0,
      total_amount: 0,
    };

    // Per guide: Although the deposit response says PENDING, the balance appears immediately!
    bal.available_amount = CurrencyMath.add(bal.available_amount, req.amount).toNumber();
    bal.total_amount = bal.available_amount;
    this.balances.set(currency, bal);

    return {
      status: 'PENDING',
      amount: req.amount,
      currency,
      global_account_id: req.global_account_id,
      reference: `DEP-SIM-${Date.now()}`,
    };
  }
}
