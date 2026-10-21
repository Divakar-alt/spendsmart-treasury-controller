import { AirwallexTreasuryAdapter } from '../airwallex/adapter';
import { Obligation, TreasuryPlan } from '../types/treasury';
import { WalletBalance, FxRate, Transfer } from '../types/airwallex';
import { TreasuryPlanner } from '../treasury/planner';

export class AgentTreasuryTools {
  private adapter: AirwallexTreasuryAdapter;

  constructor(adapter: AirwallexTreasuryAdapter) {
    this.adapter = adapter;
  }

  /**
   * Tool: Query verified balances from Airwallex API
   */
  async getVerifiedBalances(): Promise<WalletBalance[]> {
    return this.adapter.getCurrentBalances();
  }

  /**
   * Tool: Retrieve live foreign exchange rates and quotes
   */
  async getFxRates(): Promise<FxRate[]> {
    return this.adapter.getFxRates();
  }

  /**
   * Tool: Run deterministic treasury planning algorithm
   */
  runDeterministicPlanner(
    obligations: Obligation[],
    balances: WalletBalance[],
    fxRates: FxRate[],
    reserveFloorUSD?: number
  ): TreasuryPlan {
    return TreasuryPlanner.generatePlan(obligations, balances, fxRates, {
      reserveFloorUSD,
    });
  }

  /**
   * Tool: Query transfer execution status
   */
  async getTransferStatus(transferId: string): Promise<Transfer> {
    return this.adapter.getTransfer(transferId);
  }
}
