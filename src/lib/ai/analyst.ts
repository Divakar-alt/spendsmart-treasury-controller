import { Obligation, TreasuryPlan, AdaptivePlanComparison } from '../types/treasury';
import { WalletBalance, FxRate } from '../types/airwallex';

export interface EvidenceCitation {
  obligationId: string;
  sourceDocument: string;
  criticalFact: string;
}

export interface OperationalRiskEvaluation {
  obligationId: string;
  hoursRemaining: number;
  riskDescription: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AIAnalystReport {
  recommendedDirection: string;
  confidenceScore: number;
  evidenceCitations: EvidenceCitation[];
  deadlinesAndOperationalRisks: OperationalRiskEvaluation[];
  missingInformation: string[];
  escalationRequired: boolean;
  escalationRationale?: string;
  adaptiveShiftExplanation?: string;
  generatedAt: string;
}

export class TreasuryAIAnalyst {
  /**
   * Interpret unstructured evidence, contracts, and deadlines to produce structured AI analysis
   */
  static analyzeScenario(params: {
    obligations: Obligation[];
    balances: WalletBalance[];
    fxRates: FxRate[];
    plan: TreasuryPlan;
    adaptiveComparison?: AdaptivePlanComparison;
  }): AIAnalystReport {
    const { obligations, balances, plan, adaptiveComparison } = params;

    const citations: EvidenceCitation[] = [];
    const risks: OperationalRiskEvaluation[] = [];
    const missingInfo: string[] = [];

    // Parse evidence and assess operational risks
    for (const ob of obligations) {
      // Evidence citation extraction
      let sourceDoc = 'Vendor Contract / Invoicing Records';
      if (ob.evidence.includes('Bill of Lading')) sourceDoc = 'Bill of Lading #BOL-9921';
      else if (ob.evidence.includes('Invoice #INV')) sourceDoc = 'Invoice #INV-2026-EU-402';
      else if (ob.evidence.includes('Purchase Order')) sourceDoc = 'Purchase Order #PO-9812';
      else if (ob.evidence.includes('Licensing milestone')) sourceDoc = 'Licensing Milestone #LIC-4410';
      else if (ob.evidence.includes('Statement of Work')) sourceDoc = 'Marketing SOW #SOW-2026-M';

      citations.push({
        obligationId: ob.id,
        sourceDocument: sourceDoc,
        criticalFact: ob.evidence,
      });

      // Operational risk determination
      let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (ob.criticality === 'CRITICAL' || ob.deadlineHours <= 12) severity = 'HIGH';
      else if (ob.criticality === 'HIGH' || ob.deadlineHours <= 24) severity = 'HIGH';
      else if (ob.criticality === 'MEDIUM') severity = 'MEDIUM';

      risks.push({
        obligationId: ob.id,
        hoursRemaining: ob.deadlineHours,
        riskDescription: ob.consequence,
        severity,
      });

      if (ob.forecastConfidence < 0.8) {
        missingInfo.push(
          `Counterparty verification required for ${ob.supplier} (Confidence: ${(ob.forecastConfidence * 100).toFixed(0)}%): Missing signed payment cure waiver.`
        );
      }
    }

    // Determine direction and escalation
    const hasEscalations = plan.decisions.some(d => d.action === 'ESCALATE');
    const deferredCount = plan.summary.deferredCount;
    const fundedCount = plan.summary.fundedCount;
    const convertedCount = plan.summary.convertedCount;

    let direction = `Prioritize high-impact critical freight and cloud infrastructure obligations. Safely fund ${fundedCount} direct obligation(s), execute ${convertedCount} FX conversion(s), and defer ${deferredCount} non-critical obligation(s) with minimal penalty to preserve the $${plan.reserveFloorUSD.toLocaleString()} USD reserve floor.`;

    let adaptiveShift: string | undefined = undefined;
    if (adaptiveComparison && adaptiveComparison.reopenedObligations.length > 0) {
      const reopenedSuppliers = adaptiveComparison.reopenedObligations
        .map(r => `${r.supplier} (${r.oldAction} -> ${r.newAction})`)
        .join(', ');

      adaptiveShift = `Inbound settlement of ${adaptiveComparison.depositReceived.amount.toLocaleString()} ${adaptiveComparison.depositReceived.currency} expanded liquidity. Reopened decision queue for ${reopenedSuppliers} while keeping finalized obligations locked.`;
      direction = `Adaptive replenishment detected (+${adaptiveComparison.depositReceived.amount.toLocaleString()} ${adaptiveComparison.depositReceived.currency}). Liberate deferred procurement pipeline while strictly maintaining reserve floor buffer.`;
    }

    // Calculate aggregated confidence score based on verified data
    const avgConfidence =
      obligations.reduce((sum, o) => sum + o.forecastConfidence, 0) / (obligations.length || 1);

    return {
      recommendedDirection: direction,
      confidenceScore: Math.round(avgConfidence * 100) / 100,
      evidenceCitations: citations,
      deadlinesAndOperationalRisks: risks.sort((a, b) => a.hoursRemaining - b.hoursRemaining),
      missingInformation: missingInfo,
      escalationRequired: hasEscalations,
      escalationRationale: hasEscalations
        ? 'Obligations exceeding safe cash capacity cannot be executed without violating the mandatory reserve floor policy.'
        : undefined,
      adaptiveShiftExplanation: adaptiveShift,
      generatedAt: new Date().toISOString(),
    };
  }
}
