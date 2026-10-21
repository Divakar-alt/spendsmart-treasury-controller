import { SupportedCurrency, TransferMethod } from './airwallex';

export type CriticalityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Obligation {
  id: string;
  supplier: string;
  currency: SupportedCurrency;
  amount: number;
  deadlineHours: number; // Hours remaining from evaluation time (0 - 72h)
  criticality: CriticalityLevel;
  consequence: string;
  transferMethod: TransferMethod;
  swiftFee: number; // Flat fee: e.g. 12.85 for EUR SWIFT
  evidence: string;
  forecastConfidence: number; // 0.0 - 1.0 (e.g. 0.95 invoice verified, 0.40 disputed)
  paymentStatus: 'UNPAID' | 'SCHEDULED' | 'PAID' | 'DEFERRED' | 'CANCELLED';
  beneficiaryId?: string;
  beneficiaryAccountDetails?: {
    accountNumber: string;
    routingCode: string;
    bankName: string;
    country: string;
  };
}

export type DecisionAction = 'FUND' | 'CONVERT_AND_FUND' | 'DEFER' | 'ESCALATE';

export interface ObligationDecision {
  obligationId: string;
  action: DecisionAction;
  targetAmount: number;
  targetCurrency: SupportedCurrency;
  sourceAmountRequired: number; // In source currency (e.g., USD to be debited)
  sourceCurrency: SupportedCurrency;
  fxRateUsed?: number;
  fxQuoteId?: string;
  feeAmount: number; // Payout fee e.g. EUR 12.85 for SWIFT
  deferralPenaltyEstimate: number;
  reasoning: string;
  evidenceConfidence: number;
  requiresHumanApproval: boolean;
  approvalReason?: string;
  status: 'PROPOSED' | 'APPROVED' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'REJECTED' | 'LOCKED';
  executionDetails?: {
    transferId?: string;
    conversionId?: string;
    executedAt?: string;
    requestId?: string;
  };
}

export interface TreasuryPlan {
  planId: string;
  version: number;
  timestamp: string;
  totalObligationsUSD: number;
  availableCashUSD: number;
  reserveFloorUSD: number;
  projectedEndingBufferUSD: number;
  decisions: ObligationDecision[];
  summary: {
    fundedCount: number;
    convertedCount: number;
    deferredCount: number;
    escalatedCount: number;
    totalCashCommittedUSD: number;
  };
  isCompliant: boolean;
  policyViolations: string[];
  rejectedAlternatives: {
    obligationId: string;
    alternativeAction: DecisionAction;
    rejectionReason: string;
    financialImpactUSD: number;
  }[];
}

export interface AdaptivePlanComparison {
  depositReceived: {
    amount: number;
    currency: SupportedCurrency;
    source: string;
    timestamp: string;
  };
  oldPlanId: string;
  newPlanId: string;
  reopenedObligations: {
    obligationId: string;
    supplier: string;
    oldAction: DecisionAction;
    newAction: DecisionAction;
    justification: string;
    financialShiftUSD: number;
  }[];
  lockedObligations: {
    obligationId: string;
    supplier: string;
    action: DecisionAction;
    reason: string;
  }[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: 
    | 'BALANCE_READ'
    | 'PLAN_GENERATED'
    | 'DEPOSIT_SIMULATED'
    | 'ADAPTIVE_REPLAN'
    | 'APPROVAL_GRANTED'
    | 'APPROVAL_REVOKED'
    | 'FX_CONVERSION_EXECUTED'
    | 'TRANSFER_EXECUTED'
    | 'TRANSFER_STATUS_CHANGED'
    | 'RECONCILIATION_COMPLETED'
    | 'POLICY_VIOLATION_BLOCKED';
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  details: Record<string, any>;
  actor: 'DETERMINISTIC_ENGINE' | 'AI_ANALYST' | 'HUMAN_APPROVER' | 'AIRWALLEX_API' | 'RECONCILER';
}
