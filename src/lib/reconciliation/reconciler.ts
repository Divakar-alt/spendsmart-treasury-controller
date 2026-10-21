import { WalletBalance, Transfer, SupportedCurrency } from '../types/airwallex';
import { TreasuryPlan, Obligation } from '../types/treasury';
import { CurrencyMath } from '../treasury/currency-math';
import { AuditLedger } from './audit-ledger';

export interface ReconciliationDiscrepancy {
  currency: SupportedCurrency;
  expectedBalance: number;
  actualBalance: number;
  discrepancyAmount: number;
  explanation: string;
}

export interface ReconciliationReport {
  reconciliationId: string;
  timestamp: string;
  isReconciled: boolean;
  reserveFloorUSD: number;
  actualUsdBalance: number;
  reserveFloorPreserved: boolean;
  discrepancies: ReconciliationDiscrepancy[];
  transfersAudited: {
    transferId: string;
    obligationId: string;
    supplier: string;
    amount: number;
    currency: SupportedCurrency;
    status: string;
    verified: boolean;
  }[];
  auditStatus: 'MATCHED' | 'DISCREPANCY_DETECTED' | 'RESERVE_BREACH';
}

export class TreasuryReconciler {
  /**
   * Reconcile actual balances returned from Airwallex against expected ledger
   */
  static reconcile(params: {
    actualBalances: WalletBalance[];
    expectedBalances: Record<SupportedCurrency, number>;
    plan: TreasuryPlan;
    executedTransfers: Transfer[];
    obligations: Obligation[];
  }): ReconciliationReport {
    const { actualBalances, expectedBalances, plan, executedTransfers, obligations } = params;
    const discrepancies: ReconciliationDiscrepancy[] = [];
    const auditLedger = AuditLedger.getInstance();

    const actualMap: Record<SupportedCurrency, number> = {
      USD: 0,
      EUR: 0,
      GBP: 0,
    };

    for (const b of actualBalances) {
      if (actualMap[b.currency] !== undefined) {
        actualMap[b.currency] = b.available_amount;
      }
    }

    // Compare each currency balance
    const currencies: SupportedCurrency[] = ['USD', 'EUR', 'GBP'];
    for (const curr of currencies) {
      const actual = actualMap[curr];
      const expected = expectedBalances[curr] ?? actual;
      const diff = CurrencyMath.subtract(actual, expected).toNumber();

      if (Math.abs(diff) > 0.01) {
        discrepancies.push({
          currency: curr,
          expectedBalance: expected,
          actualBalance: actual,
          discrepancyAmount: diff,
          explanation: `Discrepancy of ${diff > 0 ? '+' : ''}${diff.toFixed(2)} ${curr} detected between verified API balance and expected treasury ledger.`,
        });
      }
    }

    // Verify Reserve Floor invariant
    const reserveFloorPreserved = actualMap.USD >= plan.reserveFloorUSD;

    // Audit each transfer
    const transfersAudited = executedTransfers.map(trf => {
      const dec = plan.decisions.find(d => d.executionDetails?.transferId === trf.transfer_id);
      const ob = dec ? obligations.find(o => o.id === dec.obligationId) : undefined;
      const isVerified = trf.status === 'PAID' || trf.status === 'SENT' || trf.status === 'NEW';

      return {
        transferId: trf.transfer_id,
        obligationId: dec?.obligationId || 'UNKNOWN',
        supplier: ob?.supplier || trf.beneficiary_name || 'Counterparty',
        amount: trf.transfer_amount,
        currency: trf.transfer_currency,
        status: trf.status,
        verified: isVerified,
      };
    });

    const isReconciled = discrepancies.length === 0 && reserveFloorPreserved;
    const auditStatus = !reserveFloorPreserved
      ? 'RESERVE_BREACH'
      : discrepancies.length > 0
      ? 'DISCREPANCY_DETECTED'
      : 'MATCHED';

    const report: ReconciliationReport = {
      reconciliationId: `REC-${Date.now()}`,
      timestamp: new Date().toISOString(),
      isReconciled,
      reserveFloorUSD: plan.reserveFloorUSD,
      actualUsdBalance: actualMap.USD,
      reserveFloorPreserved,
      discrepancies,
      transfersAudited,
      auditStatus,
    };

    auditLedger.log(
      'RECONCILIATION_COMPLETED',
      {
        reconciliationId: report.reconciliationId,
        auditStatus,
        actualUsdBalance: actualMap.USD,
        reserveFloorPreserved,
        discrepancyCount: discrepancies.length,
      },
      'RECONCILER',
      isReconciled ? 'INFO' : 'WARN'
    );

    return report;
  }
}
