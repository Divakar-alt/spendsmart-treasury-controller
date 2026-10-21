import { AirwallexSandboxClient } from './client';
import { AirwallexSandboxSimulator } from './simulator';
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
} from '../types/airwallex';

export type OperatingMode = 'sandbox' | 'simulator';

export class AirwallexTreasuryAdapter {
  private client: AirwallexSandboxClient;
  private simulator: AirwallexSandboxSimulator;
  private mode: OperatingMode = 'simulator';

  constructor(preferredMode?: OperatingMode) {
    this.client = new AirwallexSandboxClient();
    this.simulator = new AirwallexSandboxSimulator();

    if (preferredMode) {
      this.mode = preferredMode;
    } else if (process.env.AIRWALLEX_MODE === 'sandbox' && this.client.isConfigured()) {
      this.mode = 'sandbox';
    } else {
      this.mode = 'simulator';
    }
  }

  public getOperatingMode(): {
    mode: OperatingMode;
    isLiveConfigured: boolean;
    description: string;
  } {
    const liveConfigured = this.client.isConfigured();
    return {
      mode: this.mode,
      isLiveConfigured: liveConfigured,
      description:
        this.mode === 'sandbox'
          ? 'Live Airwallex Sandbox API connected'
          : liveConfigured
          ? 'Simulator Active (Live credentials available)'
          : 'High-Fidelity Airwallex Simulator (Offline / Synthetic Demo Mode)',
    };
  }

  public setOperatingMode(mode: OperatingMode): void {
    if (mode === 'sandbox' && !this.client.isConfigured()) {
      throw new Error(
        'Cannot switch to Live Sandbox: AWX_CLIENT_ID and AWX_API_KEY must be configured in environment or settings.'
      );
    }
    this.mode = mode;
  }

  public resetSimulator(): void {
    this.simulator.resetToBaseline();
  }

  async listGlobalAccounts(): Promise<GlobalAccount[]> {
    if (this.mode === 'sandbox') {
      try {
        const accounts = await this.client.listGlobalAccounts();
        if (accounts.length > 0) return accounts;
        // If empty, create one per guide
        const created = await this.client.createGlobalAccount('US', 'USD');
        return [created];
      } catch (err) {
        console.warn('Sandbox call failed, falling back to simulator for account listing:', err);
        return this.simulator.listGlobalAccounts();
      }
    }
    return this.simulator.listGlobalAccounts();
  }

  async getCurrentBalances(): Promise<WalletBalance[]> {
    if (this.mode === 'sandbox') {
      try {
        return await this.client.getCurrentBalances();
      } catch (err) {
        console.warn('Sandbox balance fetch failed, falling back to simulator:', err);
        return this.simulator.getCurrentBalances();
      }
    }
    return this.simulator.getCurrentBalances();
  }

  async getFxRates(): Promise<FxRate[]> {
    if (this.mode === 'sandbox') {
      try {
        return await this.client.getFxRates();
      } catch (err) {
        console.warn('Sandbox FX rates fetch failed, falling back to simulator:', err);
        return this.simulator.getFxRates();
      }
    }
    return this.simulator.getFxRates();
  }

  async createFxQuote(req: FxQuoteRequest): Promise<FxQuote> {
    if (this.mode === 'sandbox') {
      return this.client.createFxQuote(req);
    }
    return this.simulator.createFxQuote(req);
  }

  async createFxConversion(req: FxConversionRequest): Promise<FxConversion> {
    if (this.mode === 'sandbox') {
      return this.client.createFxConversion(req);
    }
    return this.simulator.createFxConversion(req);
  }

  async createBeneficiary(payload: Partial<Beneficiary>): Promise<Beneficiary> {
    if (this.mode === 'sandbox') {
      return this.client.createBeneficiary(payload);
    }
    return this.simulator.createBeneficiary(payload);
  }

  async createTransfer(req: TransferRequest): Promise<Transfer> {
    if (this.mode === 'sandbox') {
      return this.client.createTransfer(req);
    }
    return this.simulator.createTransfer(req);
  }

  async getTransfer(id: string): Promise<Transfer> {
    if (this.mode === 'sandbox') {
      return this.client.getTransfer(id);
    }
    return this.simulator.getTransfer(id);
  }

  async transitionTransfer(id: string, status: 'SENT' | 'PAID' | 'CANCELLED', failureType?: string): Promise<Transfer> {
    if (this.mode === 'sandbox') {
      return this.client.transitionTransfer(id, status, failureType);
    }
    return this.simulator.transitionTransfer(id, status, failureType);
  }

  async simulateDeposit(req: DepositSimulationRequest): Promise<DepositSimulationResponse> {
    if (this.mode === 'sandbox') {
      return this.client.simulateDeposit(req);
    }
    return this.simulator.simulateDeposit(req);
  }
}

// Global shared adapter instance
export const defaultAdapter = new AirwallexTreasuryAdapter();
