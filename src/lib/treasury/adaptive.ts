import { TreasuryPlan, Obligation, AdaptivePlanComparison, ObligationDecision } from '../types/treasury';
import { WalletBalance, FxRate, SupportedCurrency } from '../types/airwallex';
import { TreasuryPlanner } from './planner';

export class AdaptiveReconciler {
  /**
   * Recalculate plan after new deposit, keeping executed/locked decisions untouched
   * and reopening only decisions whose feasibility or economics changed.
   */
  static recalculateAfterDeposit(params: {
    previousPlan: TreasuryPlan;
    newBalances: WalletBalance[];
    obligations: Obligation[];
    fxRates: FxRate[];
    depositDetails: {
      amount: number;
      currency: SupportedCurrency;
      source: string;
    };
    executedObligationIds: Set<string>;
  }): {
    revisedPlan: TreasuryPlan;
    comparison: AdaptivePlanComparison;
  } {
    const {
      previousPlan,
      newBalances,
      obligations,
      fxRates,
      depositDetails,
      executedObligationIds,
    } = params;

    // Map existing decisions that are locked / executed
    const lockedDecisions = new Map<string, ObligationDecision>();
    for (const d of previousPlan.decisions) {
      if (executedObligationIds.has(d.obligationId) || d.status === 'EXECUTED' || d.status === 'LOCKED') {
        lockedDecisions.set(d.obligationId, {
          ...d,
          status: 'LOCKED',
        });
      }
    }

    // Generate revised plan with deterministic engine
    const revisedPlan = TreasuryPlanner.generatePlan(obligations, newBalances, fxRates, {
      lockedDecisions,
    });
    revisedPlan.version = previousPlan.version + 1;

    // Build comparison diff
    const reopenedObligations: AdaptivePlanComparison['reopenedObligations'] = [];
    const lockedList: AdaptivePlanComparison['lockedObligations'] = [];

    const oldDecisionMap = new Map(previousPlan.decisions.map(d => [d.obligationId, d]));

    for (const newDec of revisedPlan.decisions) {
      const oldDec = oldDecisionMap.get(newDec.obligationId);
      const ob = obligations.find(o => o.id === newDec.obligationId);
      const supplierName = ob?.supplier || newDec.obligationId;

      if (lockedDecisions.has(newDec.obligationId)) {
        lockedList.push({
          obligationId: newDec.obligationId,
          supplier: supplierName,
          action: newDec.action,
          reason: 'Decision already finalized and executed prior to deposit arrival. Invariant: Past payments are not reopened.',
        });
      } else if (oldDec && oldDec.action !== newDec.action) {
        // Material decision change occurred!
        reopenedObligations.push({
          obligationId: newDec.obligationId,
          supplier: supplierName,
          oldAction: oldDec.action,
          newAction: newDec.action,
          justification: `Deposit of ${depositDetails.amount.toLocaleString()} ${depositDetails.currency} expanded liquidity. Changed from ${oldDec.action} to ${newDec.action} without violating reserve floor.`,
          financialShiftUSD: newDec.sourceAmountRequired,
        });
      } else {
        // Unchanged
        lockedList.push({
          obligationId: newDec.obligationId,
          supplier: supplierName,
          action: newDec.action,
          reason: 'Obligation priority and capital availability remain stable. No change required.',
        });
      }
    }

    const comparison: AdaptivePlanComparison = {
      depositReceived: {
        amount: depositDetails.amount,
        currency: depositDetails.currency,
        source: depositDetails.source,
        timestamp: new Date().toISOString(),
      },
      oldPlanId: previousPlan.planId,
      newPlanId: revisedPlan.planId,
      reopenedObligations,
      lockedObligations: lockedList,
    };

    return { revisedPlan, comparison };
  }
}
