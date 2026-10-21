import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TreasuryPlanner } from '../src/lib/treasury/planner';
import { CurrencyMath } from '../src/lib/treasury/currency-math';
import { AdaptiveReconciler } from '../src/lib/treasury/adaptive';
import { ApprovalGate } from '../src/lib/security/approval-gate';
import { TreasuryReconciler } from '../src/lib/reconciliation/reconciler';
import { AirwallexSandboxSimulator } from '../src/lib/airwallex/simulator';
import { INITIAL_OBLIGATIONS, INITIAL_WALLET_BALANCES, INITIAL_FX_RATES, TREASURY_POLICY_RULES } from '../src/lib/treasury/baseline';
import { Obligation } from '../src/lib/types/treasury';
import { WalletBalance } from '../src/lib/types/airwallex';

describe('SpendSmart AI - Adaptive Treasury Controller Test Suite', () => {
  let obligations: Obligation[];
  let balances: WalletBalance[];

  beforeEach(() => {
    obligations = JSON.parse(JSON.stringify(INITIAL_OBLIGATIONS));
    balances = JSON.parse(JSON.stringify(INITIAL_WALLET_BALANCES));
  });

  test('Decimal-safe currency math avoids floating point imprecision', () => {
    // 0.1 + 0.2 in JS is 0.30000000000000004
    const result = CurrencyMath.add(0.1, 0.2);
    assert.equal(result.toNumber(), 0.3);

    // Precise FX conversion
    const conv = CurrencyMath.calculateConversionCost(10212.85, 1.0877);
    assert.equal(conv.sourceAmountRequired, 11108.52);
  });

  test('Deterministic planner enforces strict reserve floor protection', () => {
    const plan = TreasuryPlanner.generatePlan(obligations, balances, INITIAL_FX_RATES, {
      reserveFloorUSD: 10000.0,
    });

    assert.equal(plan.isCompliant, true);
    assert.ok(plan.projectedEndingBufferUSD >= 10000.0, 'Ending USD cash must not fall below reserve floor');
  });

  test('Ranks critical obligations first and defers cheaper non-critical obligation', () => {
    const plan = TreasuryPlanner.generatePlan(obligations, balances, INITIAL_FX_RATES);

    // Critical Logistics obligation must be funded
    const logisticsDecision = plan.decisions.find(d => d.obligationId === 'OBL-001-LOGISTICS');
    assert.ok(logisticsDecision);
    assert.equal(logisticsDecision.action, 'FUND');

    // High priority Cloud Infra must be converted and funded
    const cloudDecision = plan.decisions.find(d => d.obligationId === 'OBL-002-CLOUD-INFRA');
    assert.ok(cloudDecision);
    assert.equal(cloudDecision.action, 'CONVERT_AND_FUND');
    assert.equal(cloudDecision.feeAmount, 12.85, 'Must include flat EUR 12.85 SWIFT fee');

    // Delta Materials ($22,000 USD) must be DEFERRED because paying it would breach the reserve floor
    const materialsDecision = plan.decisions.find(d => d.obligationId === 'OBL-004-MATERIALS');
    assert.ok(materialsDecision);
    assert.equal(materialsDecision.action, 'DEFER');
    assert.ok(materialsDecision.deferralPenaltyEstimate > 0);
  });

  test('Escalates when a critical obligation cannot be satisfied without breaching reserve floor', () => {
    // Artificial severe cash crunch: only $16,000 USD available with $10,000 reserve floor
    // Logistics is $18,500 USD (needs at least $18,500 + $10,000 = $28,500)
    const tightBalances: WalletBalance[] = [
      { currency: 'USD', available_amount: 16000.0, pending_amount: 0, reserved_amount: 0, total_amount: 16000.0 },
      { currency: 'EUR', available_amount: 0, pending_amount: 0, reserved_amount: 0, total_amount: 0 },
      { currency: 'GBP', available_amount: 0, pending_amount: 0, reserved_amount: 0, total_amount: 0 },
    ];

    const plan = TreasuryPlanner.generatePlan(obligations, tightBalances, INITIAL_FX_RATES, {
      reserveFloorUSD: 10000.0,
    });

    const logisticsDecision = plan.decisions.find(d => d.obligationId === 'OBL-001-LOGISTICS');
    assert.ok(logisticsDecision);
    assert.equal(logisticsDecision.action, 'ESCALATE', 'Must escalate critical obligation when reserve floor would be breached');
    assert.equal(plan.isCompliant, false);
  });

  test('Adaptive replan reopens only affected decisions after deposit arrives', () => {
    // 1. Initial Plan
    const initialPlan = TreasuryPlanner.generatePlan(obligations, balances, INITIAL_FX_RATES);
    const materialsOld = initialPlan.decisions.find(d => d.obligationId === 'OBL-004-MATERIALS');
    assert.equal(materialsOld?.action, 'DEFER');

    // 2. Simulate executed decisions: Mark OB-001 and OB-002 as executed
    const executedIds = new Set(['OBL-001-LOGISTICS', 'OBL-002-CLOUD-INFRA']);

    // 3. Deposit of +$35,000 USD lands in sandbox
    const updatedBalances: WalletBalance[] = [
      { currency: 'USD', available_amount: 42000.0 - 18500.0 - 11108.52 + 35000.0, pending_amount: 0, reserved_amount: 0, total_amount: 47391.48 },
      { currency: 'EUR', available_amount: 0, pending_amount: 0, reserved_amount: 0, total_amount: 0 },
      { currency: 'GBP', available_amount: 1500.0, pending_amount: 0, reserved_amount: 0, total_amount: 1500.0 },
    ];

    const { revisedPlan, comparison } = AdaptiveReconciler.recalculateAfterDeposit({
      previousPlan: initialPlan,
      newBalances: updatedBalances,
      obligations,
      fxRates: INITIAL_FX_RATES,
      depositDetails: {
        amount: 35000.0,
        currency: 'USD',
        source: 'Client Acme Deposit',
      },
      executedObligationIds: executedIds,
    });

    // OB-001 and OB-002 must remain locked
    const locked1 = comparison.lockedObligations.find(l => l.obligationId === 'OBL-001-LOGISTICS');
    assert.ok(locked1, 'OB-001 must remain locked and not reopened');

    // OB-004 must be reopened from DEFER -> FUND
    const reopenedMaterials = comparison.reopenedObligations.find(r => r.obligationId === 'OBL-004-MATERIALS');
    assert.ok(reopenedMaterials, 'OB-004 must be reopened');
    assert.equal(reopenedMaterials.oldAction, 'DEFER');
    assert.equal(reopenedMaterials.newAction, 'FUND');

    // Reserve floor is preserved in revised plan
    assert.ok(revisedPlan.projectedEndingBufferUSD >= 10000.0);
  });

  test('Approval Gate invalidates approval if parameters change', () => {
    const gate = new ApprovalGate();
    const decision = {
      obligationId: 'OBL-004-MATERIALS',
      action: 'FUND' as const,
      targetAmount: 22000.0,
      targetCurrency: 'USD' as const,
      sourceAmountRequired: 22000.0,
      sourceCurrency: 'USD' as const,
      feeAmount: 0,
      deferralPenaltyEstimate: 0,
      reasoning: 'Test',
      evidenceConfidence: 0.9,
      requiresHumanApproval: true,
      status: 'PROPOSED' as const,
    };

    // Record human approval
    const record = gate.approveAction(decision, 'Chief Risk Officer');
    assert.ok(record.approvalId);

    // Verification passes with original parameters
    const check1 = gate.verifyExecutionAuthorization(decision);
    assert.equal(check1.isAuthorized, true);

    // Tamper / drift parameter (e.g. increase target amount to $25,000)
    const tamperedDecision = { ...decision, targetAmount: 25000.0, sourceAmountRequired: 25000.0 };
    const check2 = gate.verifyExecutionAuthorization(tamperedDecision);
    assert.equal(check2.isAuthorized, false, 'Tampered parameters must invalidate prior approval');
    assert.match(check2.reason, /PARAMETER_DRIFT/);
  });

  test('Airwallex Sandbox Simulator enforces idempotency and duplicate request ID rejection', async () => {
    const simulator = new AirwallexSandboxSimulator();
    const reqId = 'req_id_unique_test_12345';

    // First quote succeeds
    await simulator.createFxQuote({
      request_id: reqId,
      buy_currency: 'EUR',
      sell_currency: 'USD',
      buy_amount: 1000,
    });

    // Reusing same request ID on different operation must be rejected
    await assert.rejects(
      async () => {
        await simulator.createTransfer({
          request_id: reqId,
          beneficiary_id: 'ben_logistics_01',
          transfer_amount: 500,
          transfer_currency: 'USD',
          transfer_method: 'LOCAL',
        });
      },
      /duplicate_request_id/
    );
  });

  test('Airwallex Sandbox Simulator blocks transfers exceeding available funds', async () => {
    const simulator = new AirwallexSandboxSimulator();
    const uniqueReqId = 'req_exceed_transfer_99999';

    // Attempt to transfer $500,000 USD when only $32,000 available
    await assert.rejects(
      async () => {
        await simulator.createTransfer({
          request_id: uniqueReqId,
          beneficiary_id: 'ben_logistics_01',
          transfer_amount: 500000,
          transfer_currency: 'USD',
          transfer_method: 'LOCAL',
        });
      },
      /balance_insufficient/
    );
  });

  test('Treasury Reconciler detects balance discrepancies and reserve floor breaches', () => {
    const plan = TreasuryPlanner.generatePlan(obligations, balances, INITIAL_FX_RATES);

    // Report matching state
    const matchReport = TreasuryReconciler.reconcile({
      actualBalances: balances,
      expectedBalances: { USD: 42000.0, EUR: 4000.0, GBP: 1500.0 },
      plan,
      executedTransfers: [],
      obligations,
    });
    assert.equal(matchReport.isReconciled, true);
    assert.equal(matchReport.auditStatus, 'MATCHED');

    // Report discrepancy state ($30,000 actual vs $42,000 expected)
    const discrepancyBalances: WalletBalance[] = [
      { currency: 'USD', available_amount: 30000.0, pending_amount: 0, reserved_amount: 0, total_amount: 30000.0 },
      { currency: 'EUR', available_amount: 4000.0, pending_amount: 0, reserved_amount: 0, total_amount: 4000.0 },
      { currency: 'GBP', available_amount: 1500.0, pending_amount: 0, reserved_amount: 0, total_amount: 1500.0 },
    ];
    const diffReport = TreasuryReconciler.reconcile({
      actualBalances: discrepancyBalances,
      expectedBalances: { USD: 42000.0, EUR: 4000.0, GBP: 1500.0 },
      plan,
      executedTransfers: [],
      obligations,
    });
    assert.equal(diffReport.isReconciled, false);
    assert.equal(diffReport.discrepancies.length, 1);
    assert.equal(diffReport.auditStatus, 'DISCREPANCY_DETECTED');
  });

  test('Transfer failure transitions correctly and records failure_type', async () => {
    const simulator = new AirwallexSandboxSimulator();
    const reqId = 'trf_sim_fail_test_777';

    const trf = await simulator.createTransfer({
      request_id: reqId,
      beneficiary_id: 'ben_logistics_01',
      transfer_amount: 1000,
      transfer_currency: 'USD',
      transfer_method: 'LOCAL',
    });
    assert.equal(trf.status, 'NEW');

    // Transition to SENT (in-flight per guide)
    const sentTrf = await simulator.transitionTransfer(trf.transfer_id, 'SENT');
    assert.equal(sentTrf.status, 'SENT');

    // Transition to CANCELLED with failure type (e.g. BANK_RETURN)
    const failedTrf = await simulator.transitionTransfer(trf.transfer_id, 'CANCELLED', 'BANK_RETURN');
    assert.equal(failedTrf.status, 'CANCELLED');
    assert.equal(failedTrf.failure_type, 'BANK_RETURN');
    assert.match(failedTrf.failure_reason!, /cancelled/i);
  });

  test('FX conversions include flat SWIFT fee and settle immediately', async () => {
    const simulator = new AirwallexSandboxSimulator();
    const reqId = 'cnv_sim_test_888';

    // Buy 10,212.85 EUR (which includes €10,200 obligation + €12.85 SWIFT fee)
    const conversion = await simulator.createFxConversion({
      request_id: reqId,
      buy_currency: 'EUR',
      sell_currency: 'USD',
      buy_amount: 10212.85,
    });

    assert.equal(conversion.status, 'SETTLED');
    assert.equal(conversion.buy_amount, 10212.85);
    assert.ok(conversion.sell_amount > 10212.85, 'USD sell amount reflects exchange rate');
    
    // Check wallet balances updated immediately
    const balancesAfter = await simulator.getCurrentBalances();
    const eurBal = balancesAfter.find(b => b.currency === 'EUR');
    assert.equal(eurBal?.available_amount, 4000.0 + 10212.85);
  });
});

