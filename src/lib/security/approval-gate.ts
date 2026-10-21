import crypto from 'crypto';
import { ObligationDecision } from '../types/treasury';
import { TREASURY_POLICY_RULES } from '../treasury/baseline';

export interface ActionApprovalRecord {
  approvalId: string;
  obligationId: string;
  actionHash: string;
  parameters: {
    action: string;
    targetAmount: number;
    targetCurrency: string;
    sourceAmountRequired: number;
    sourceCurrency: string;
  };
  approvedBy: string;
  approvedAt: string;
  revoked: boolean;
  revocationReason?: string;
}

export class ApprovalGate {
  private approvals: Map<string, ActionApprovalRecord> = new Map();

  /**
   * Deterministically hash material parameters of a proposed decision.
   * Any change in amount, currency, or action invalidates the hash.
   */
  static computeActionHash(decision: ObligationDecision): string {
    const payload = JSON.stringify({
      obligationId: decision.obligationId,
      action: decision.action,
      targetAmount: decision.targetAmount,
      targetCurrency: decision.targetCurrency,
      sourceAmountRequired: decision.sourceAmountRequired,
      sourceCurrency: decision.sourceCurrency,
      feeAmount: decision.feeAmount,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Determine if an action can be executed autonomously without human signature
   */
  static evaluateAutonomousEligibility(decision: ObligationDecision): {
    canExecuteAutonomously: boolean;
    reason?: string;
  } {
    if (decision.action === 'ESCALATE') {
      return {
        canExecuteAutonomously: false,
        reason: 'Policy exception: Escalations always require human committee resolution.',
      };
    }

    if (decision.sourceAmountRequired > TREASURY_POLICY_RULES.AUTONOMOUS_EXECUTION_MAX_USD) {
      return {
        canExecuteAutonomously: false,
        reason: `Threshold exceeded: Required source amount ($${decision.sourceAmountRequired.toLocaleString()}) exceeds autonomous limit of $${TREASURY_POLICY_RULES.AUTONOMOUS_EXECUTION_MAX_USD.toLocaleString()} USD.`,
      };
    }

    if (decision.evidenceConfidence < TREASURY_POLICY_RULES.AUTONOMOUS_CONFIDENCE_THRESHOLD) {
      return {
        canExecuteAutonomously: false,
        reason: `Confidence low: Evidence confidence (${decision.evidenceConfidence}) is below autonomous safety threshold (${TREASURY_POLICY_RULES.AUTONOMOUS_CONFIDENCE_THRESHOLD}).`,
      };
    }

    return { canExecuteAutonomously: true };
  }

  /**
   * Record a human approval
   */
  approveAction(decision: ObligationDecision, approver: string = 'Treasury Officer'): ActionApprovalRecord {
    const actionHash = ApprovalGate.computeActionHash(decision);
    const approvalId = `APP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const record: ActionApprovalRecord = {
      approvalId,
      obligationId: decision.obligationId,
      actionHash,
      parameters: {
        action: decision.action,
        targetAmount: decision.targetAmount,
        targetCurrency: decision.targetCurrency,
        sourceAmountRequired: decision.sourceAmountRequired,
        sourceCurrency: decision.sourceCurrency,
      },
      approvedBy: approver,
      approvedAt: new Date().toISOString(),
      revoked: false,
    };

    this.approvals.set(decision.obligationId, record);
    return record;
  }

  /**
   * Revoke existing approval
   */
  revokeApproval(obligationId: string, reason: string): void {
    const existing = this.approvals.get(obligationId);
    if (existing) {
      existing.revoked = true;
      existing.revocationReason = reason;
    }
  }

  /**
   * Verify if a decision is authorized to execute.
   * If autonomous, verifies parameters. If human-required, verifies valid cryptographic approval record.
   */
  verifyExecutionAuthorization(decision: ObligationDecision): {
    isAuthorized: boolean;
    reason: string;
  } {
    const autonomous = ApprovalGate.evaluateAutonomousEligibility(decision);
    const approval = this.approvals.get(decision.obligationId);

    // If decision requires human approval or an approval was registered for it
    if (decision.requiresHumanApproval || !autonomous.canExecuteAutonomously || approval) {
      if (!approval) {
        return {
          isAuthorized: false,
          reason: `Execution blocked: Action requires human approval. ${autonomous.reason || 'Human approval mandatory.'}`,
        };
      }

      if (approval.revoked) {
        return {
          isAuthorized: false,
          reason: `Execution blocked: Approval was revoked. Reason: ${approval.revocationReason}`,
        };
      }

      // Verify hash integrity (ensures parameters were not tampered or altered)
      const currentHash = ApprovalGate.computeActionHash(decision);
      if (currentHash !== approval.actionHash) {
        return {
          isAuthorized: false,
          reason: 'Execution blocked [PARAMETER_DRIFT]: Material action parameters changed after approval was granted. Renewal required.',
        };
      }

      return {
        isAuthorized: true,
        reason: `Authorized by human approval record ${approval.approvalId} (signed by ${approval.approvedBy}).`,
      };
    }

    return { isAuthorized: true, reason: 'Authorized by autonomous policy rule engine.' };
  }
}
