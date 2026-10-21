import { v4 as uuidv4 } from 'uuid';
import { AirwallexTreasuryAdapter, defaultAdapter } from '../airwallex/adapter';
import { Obligation, ObligationDecision, TreasuryPlan, AdaptivePlanComparison } from '../types/treasury';
import { WalletBalance, FxRate, Transfer, SupportedCurrency } from '../types/airwallex';
import { INITIAL_OBLIGATIONS, SIMULATED_CUSTOMER_DEPOSIT } from './baseline';
import { TreasuryPlanner } from './planner';
import { AdaptiveReconciler } from './adaptive';
import { ApprovalGate } from '../security/approval-gate';
import { TreasuryAIAnalyst, AIAnalystReport } from '../ai/analyst';
import { TreasuryReconciler, ReconciliationReport } from '../reconciliation/reconciler';
import { AuditLedger } from '../reconciliation/audit-ledger';

export interface TreasuryState {
  operatingMode: {
    mode: 'sandbox' | 'simulator';
    isLiveConfigured: boolean;
    description: string;
  };
  balances: WalletBalance[];
  obligations: Obligation[];
  fxRates: FxRate[];
  originalPlan: TreasuryPlan | null;
  currentPlan: TreasuryPlan | null;
  adaptiveComparison: AdaptivePlanComparison | null;
  aiAnalysis: AIAnalystReport | null;
  executedTransfers: Transfer[];
  reconciliationReport: ReconciliationReport | null;
  auditTrail: any[];
}

export class TreasuryController {
  private adapter: AirwallexTreasuryAdapter;
  private approvalGate: ApprovalGate;
  private auditLedger: AuditLedger;

  private obligations: Obligation[] = [];
  private originalPlan: TreasuryPlan | null = null;
  private currentPlan: TreasuryPlan | null = null;
  private adaptiveComparison: AdaptivePlanComparison | null = null;
  private aiAnalysis: AIAnalystReport | null = null;
  private executedTransfers: Transfer[] = [];
  private executedObligationIds: Set<string> = new Set();
  private expectedBalances: Record<SupportedCurrency, number> = {
    USD: 42000.0,
    EUR: 4000.0,
    GBP: 1500.0,
  };

  constructor(adapter: AirwallexTreasuryAdapter = defaultAdapter) {
    this.adapter = adapter;
    this.approvalGate = new ApprovalGate();
    this.auditLedger = AuditLedger.getInstance();
    this.reset();
  }

  public reset(): void {
    this.adapter.resetSimulator();
    this.obligations = JSON.parse(JSON.stringify(INITIAL_OBLIGATIONS));
    this.originalPlan = null;
    this.currentPlan = null;
    this.adaptiveComparison = null;
    this.aiAnalysis = null;
    this.executedTransfers = [];
    this.executedObligationIds.clear();
    this.expectedBalances = {
      USD: 42000.0,
      EUR: 4000.0,
      GBP: 1500.0,
    };
    this.auditLedger.clear();

    this.auditLedger.log(
      'BALANCE_READ',
      { status: 'Initialized treasury scenario baseline' },
      'DETERMINISTIC_ENGINE'
    );
  }

  public getApprovalGate(): ApprovalGate {
    return this.approvalGate;
  }

  public getAdapter(): AirwallexTreasuryAdapter {
    return this.adapter;
  }

  /**
   * Snapshot current controller state for UI
   */
  async getState(): Promise<TreasuryState> {
    const balances = await this.adapter.getCurrentBalances();
    const fxRates = await this.adapter.getFxRates();

    let reconciliationReport: ReconciliationReport | null = null;
    if (this.currentPlan) {
      reconciliationReport = TreasuryReconciler.reconcile({
        actualBalances: balances,
        expectedBalances: this.expectedBalances,
        plan: this.currentPlan,
        executedTransfers: this.executedTransfers,
        obligations: this.obligations,
      });
    }

    return {
      operatingMode: this.adapter.getOperatingMode(),
      balances,
      obligations: [...this.obligations],
      fxRates,
      originalPlan: this.originalPlan,
      currentPlan: this.currentPlan,
      adaptiveComparison: this.adaptiveComparison,
      aiAnalysis: this.aiAnalysis,
      executedTransfers: [...this.executedTransfers],
      reconciliationReport,
      auditTrail: this.auditLedger.getEntries().reverse(),
    };
  }

  /**
   * Phase 1 & 3: Run deterministic planner on current balances and generate AI analysis
   */
  async runInitialPlan(): Promise<TreasuryState> {
    const balances = await this.adapter.getCurrentBalances();
    const fxRates = await this.adapter.getFxRates();

    const plan = TreasuryPlanner.generatePlan(this.obligations, balances, fxRates);
    this.originalPlan = plan;
    this.currentPlan = plan;

    this.auditLedger.log(
      'PLAN_GENERATED',
      {
        planId: plan.planId,
        availableCashUSD: plan.availableCashUSD,
        reserveFloorUSD: plan.reserveFloorUSD,
        fundedCount: plan.summary.fundedCount,
        convertedCount: plan.summary.convertedCount,
        deferredCount: plan.summary.deferredCount,
        escalatedCount: plan.summary.escalatedCount,
      },
      'DETERMINISTIC_ENGINE'
    );

    // Run AI Analyst interpretation
    this.aiAnalysis = TreasuryAIAnalyst.analyzeScenario({
      obligations: this.obligations,
      balances,
      fxRates,
      plan,
    });

    return this.getState();
  }

  /**
   * Phase 5 & 8: Execute permitted and approved actions through Airwallex API
   */
  async executeDecision(obligationId: string): Promise<{ success: boolean; message: string; state: TreasuryState }> {
    if (!this.currentPlan) {
      throw new Error('No active treasury plan exists. Generate plan before executing actions.');
    }

    const decision = this.currentPlan.decisions.find(d => d.obligationId === obligationId);
    if (!decision) {
      throw new Error(`Decision for obligation ${obligationId} not found in plan.`);
    }

    if (this.executedObligationIds.has(obligationId)) {
      throw new Error(`Obligation ${obligationId} has already been executed.`);
    }

    // Verify Authorization with Approval Gate
    const auth = this.approvalGate.verifyExecutionAuthorization(decision);
    if (!auth.isAuthorized) {
      this.auditLedger.log(
        'POLICY_VIOLATION_BLOCKED',
        { obligationId, reason: auth.reason },
        'DETERMINISTIC_ENGINE',
        'WARN'
      );
      throw new Error(auth.reason);
    }

    const obligation = this.obligations.find(o => o.id === obligationId);
    if (!obligation) throw new Error(`Obligation details for ${obligationId} not found.`);

    let conversionRecord = undefined;

    // Step 1: If action is CONVERT_AND_FUND, execute FX Quote & Conversion for the minimum deficit needed
    if (decision.action === 'CONVERT_AND_FUND') {
      const currentBalances = await this.adapter.getCurrentBalances();
      const existingLocal = currentBalances.find(b => b.currency === decision.targetCurrency)?.available_amount || 0;
      const totalNeeded = decision.targetAmount + decision.feeAmount;
      const deficitToBuy = Math.max(0, Math.round((totalNeeded - existingLocal) * 100) / 100);

      const quoteReqId = uuidv4();
      const quote = await this.adapter.createFxQuote({
        request_id: quoteReqId,
        buy_currency: decision.targetCurrency,
        sell_currency: decision.sourceCurrency,
        buy_amount: deficitToBuy,
      });

      const convReqId = uuidv4();
      const conversion = await this.adapter.createFxConversion({
        request_id: convReqId,
        quote_id: quote.quote_id,
        buy_currency: decision.targetCurrency,
        sell_currency: decision.sourceCurrency,
        buy_amount: quote.buy_amount,
        sell_amount: quote.sell_amount,
      });

      conversionRecord = conversion.conversion_id;

      // Update expected ledger balances
      this.expectedBalances[decision.sourceCurrency] = 
        Math.round((this.expectedBalances[decision.sourceCurrency] - conversion.sell_amount) * 100) / 100;
      this.expectedBalances[decision.targetCurrency] = 
        Math.round((this.expectedBalances[decision.targetCurrency] + conversion.buy_amount) * 100) / 100;

      this.auditLedger.log(
        'FX_CONVERSION_EXECUTED',
        {
          conversionId: conversion.conversion_id,
          sold: `${conversion.sell_amount} ${conversion.sell_currency}`,
          bought: `${conversion.buy_amount} ${conversion.buy_currency}`,
          rate: conversion.rate,
        },
        'AIRWALLEX_API'
      );
    }

    // Step 2: Ensure Beneficiary Exists
    const beneficiary = await this.adapter.createBeneficiary({
      company_name: obligation.supplier,
      bank_details: {
        account_number: obligation.beneficiaryAccountDetails?.accountNumber,
        account_routing_value1: obligation.beneficiaryAccountDetails?.routingCode,
        bank_name: obligation.beneficiaryAccountDetails?.bankName,
      },
      address: {
        street_address: '100 Business Parkway',
        city: 'Commercial District',
        country_code: obligation.beneficiaryAccountDetails?.country || 'US',
      },
      transfer_methods: [obligation.transferMethod],
    });

    // Step 3: Create Transfer with Unique Request ID
    const transferReqId = uuidv4();
    const transfer = await this.adapter.createTransfer({
      request_id: transferReqId,
      beneficiary_id: beneficiary.beneficiary_id,
      transfer_amount: decision.targetAmount,
      transfer_currency: decision.targetCurrency,
      transfer_method: obligation.transferMethod,
      reference: `SpendSmart-${obligation.id}`,
    });

    // Step 4: Advance status transition (Simulation of settlement: NEW -> SENT -> PAID)
    await this.adapter.transitionTransfer(transfer.transfer_id, 'SENT');
    const finalizedTransfer = await this.adapter.transitionTransfer(transfer.transfer_id, 'PAID');

    // Update expected ledger balances after transfer
    const totalDebit = decision.targetAmount + decision.feeAmount;
    this.expectedBalances[decision.targetCurrency] = 
      Math.round((this.expectedBalances[decision.targetCurrency] - totalDebit) * 100) / 100;

    // Record execution state
    this.executedTransfers.push(finalizedTransfer);
    this.executedObligationIds.add(obligationId);
    obligation.paymentStatus = 'PAID';

    decision.status = 'EXECUTED';
    decision.executionDetails = {
      transferId: finalizedTransfer.transfer_id,
      conversionId: conversionRecord,
      executedAt: new Date().toISOString(),
      requestId: transferReqId,
    };

    this.auditLedger.log(
      'TRANSFER_EXECUTED',
      {
        transferId: finalizedTransfer.transfer_id,
        obligationId,
        supplier: obligation.supplier,
        amount: `${decision.targetAmount} ${decision.targetCurrency}`,
        fee: `${decision.feeAmount} ${decision.targetCurrency}`,
        status: finalizedTransfer.status,
      },
      'AIRWALLEX_API'
    );

    const state = await this.getState();
    return {
      success: true,
      message: `Executed payout of ${decision.targetAmount.toLocaleString()} ${decision.targetCurrency} to ${obligation.supplier} (Transfer ID: ${finalizedTransfer.transfer_id}).`,
      state,
    };
  }

  /**
   * Phase 6: Simulate later deposit arrival and adaptively replan
   */
  async simulateDepositAndAdaptiveReplan(depositAmount: number = SIMULATED_CUSTOMER_DEPOSIT.amount): Promise<TreasuryState> {
    if (!this.currentPlan) {
      throw new Error('Generate initial plan before simulating deposit.');
    }

    // 1. Simulate deposit on Airwallex API
    const depositRes = await this.adapter.simulateDeposit({
      global_account_id: SIMULATED_CUSTOMER_DEPOSIT.globalAccountId,
      amount: depositAmount,
      currency: 'USD',
      payer_name: SIMULATED_CUSTOMER_DEPOSIT.payerName,
    });

    this.expectedBalances.USD = Math.round((this.expectedBalances.USD + depositAmount) * 100) / 100;

    this.auditLedger.log(
      'DEPOSIT_SIMULATED',
      {
        amount: depositAmount,
        currency: 'USD',
        reference: depositRes.reference,
        payer: SIMULATED_CUSTOMER_DEPOSIT.payerName,
      },
      'AIRWALLEX_API'
    );

    // 2. Verified API read (Do NOT assume balance; fetch from API per guide!)
    const freshBalances = await this.adapter.getCurrentBalances();
    const fxRates = await this.adapter.getFxRates();

    // 3. Adaptive replan: Reopen ONLY affected decisions; keep locked/executed items intact
    const { revisedPlan, comparison } = AdaptiveReconciler.recalculateAfterDeposit({
      previousPlan: this.currentPlan,
      newBalances: freshBalances,
      obligations: this.obligations,
      fxRates,
      depositDetails: {
        amount: depositAmount,
        currency: 'USD',
        source: SIMULATED_CUSTOMER_DEPOSIT.payerName,
      },
      executedObligationIds: this.executedObligationIds,
    });

    this.currentPlan = revisedPlan;
    this.adaptiveComparison = comparison;

    this.auditLedger.log(
      'ADAPTIVE_REPLAN',
      {
        reopenedCount: comparison.reopenedObligations.length,
        lockedCount: comparison.lockedObligations.length,
        revisedAvailableCashUSD: revisedPlan.availableCashUSD,
      },
      'DETERMINISTIC_ENGINE'
    );

    // 4. Update AI Analysis with adaptive delta
    this.aiAnalysis = TreasuryAIAnalyst.analyzeScenario({
      obligations: this.obligations,
      balances: freshBalances,
      fxRates,
      plan: revisedPlan,
      adaptiveComparison: comparison,
    });

    return this.getState();
  }
}

// Global controller instance
export const defaultController = new TreasuryController();
