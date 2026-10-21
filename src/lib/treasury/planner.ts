import { v4 as uuidv4 } from 'uuid';
import { Obligation, ObligationDecision, TreasuryPlan, CriticalityLevel, DecisionAction } from '../types/treasury';
import { WalletBalance, FxRate, SupportedCurrency } from '../types/airwallex';
import { CurrencyMath } from './currency-math';
import { TREASURY_POLICY_RULES } from './baseline';

export interface PlannerOptions {
  reserveFloorUSD?: number;
  autonomousLimitUSD?: number;
  confidenceThreshold?: number;
  lockedDecisions?: Map<string, ObligationDecision>;
}

export class TreasuryPlanner {
  /**
   * Deterministic priority ranker:
   * Combines criticality, deadline urgency, and operational consequence severity.
   */
  static calculatePriorityScore(obligation: Obligation): number {
    const criticalityScores: Record<CriticalityLevel, number> = {
      CRITICAL: 1000,
      HIGH: 500,
      MEDIUM: 200,
      LOW: 50,
    };

    const baseScore = criticalityScores[obligation.criticality] || 0;
    // Urgency bonus: 0 to 360 points (shorter deadline = higher score)
    const urgencyBonus = Math.max(0, (72 - obligation.deadlineHours) * 5);
    // Confidence penalty if evidence is low
    const confidencePenalty = (1.0 - obligation.forecastConfidence) * 100;

    return baseScore + urgencyBonus - confidencePenalty;
  }

  /**
   * Core deterministic planning algorithm
   */
  static generatePlan(
    obligations: Obligation[],
    balances: WalletBalance[],
    fxRates: FxRate[],
    options: PlannerOptions = {}
  ): TreasuryPlan {
    const reserveFloorUSD = options.reserveFloorUSD ?? TREASURY_POLICY_RULES.MINIMUM_RESERVE_FLOOR_USD;
    const autonomousLimitUSD = options.autonomousLimitUSD ?? TREASURY_POLICY_RULES.AUTONOMOUS_EXECUTION_MAX_USD;
    const confidenceThreshold = options.confidenceThreshold ?? TREASURY_POLICY_RULES.AUTONOMOUS_CONFIDENCE_THRESHOLD;
    const lockedDecisions = options.lockedDecisions ?? new Map<string, ObligationDecision>();

    // Index FX rates
    const ratesMap: Record<string, number> = {};
    for (const r of fxRates) {
      ratesMap[`${r.buy_currency}_${r.sell_currency}`] = r.client_rate || r.rate;
    }
    // Default fallback rates if not found
    if (!ratesMap['EUR_USD']) ratesMap['EUR_USD'] = 1.0877;
    if (!ratesMap['GBP_USD']) ratesMap['GBP_USD'] = 1.2982;
    if (!ratesMap['USD_EUR']) ratesMap['USD_EUR'] = 0.9193;
    if (!ratesMap['USD_GBP']) ratesMap['USD_GBP'] = 0.7702;

    // Clone working balances using safe Decimal math
    const workingBalances: Record<SupportedCurrency, number> = {
      USD: 0,
      EUR: 0,
      GBP: 0,
    };
    for (const b of balances) {
      if (workingBalances[b.currency] !== undefined) {
        workingBalances[b.currency] = b.available_amount;
      }
    }

    const initialUsdAvailable = workingBalances.USD;
    const decisions: ObligationDecision[] = [];
    const policyViolations: string[] = [];
    const rejectedAlternatives: TreasuryPlan['rejectedAlternatives'] = [];

    // Sort obligations by deterministic priority
    const sortedObligations = [...obligations].sort(
      (a, b) => TreasuryPlanner.calculatePriorityScore(b) - TreasuryPlanner.calculatePriorityScore(a)
    );

    let totalCommittedUSD = 0;

    for (const ob of sortedObligations) {
      // 1. If previously executed or locked, retain state
      if (lockedDecisions.has(ob.id)) {
        const locked = lockedDecisions.get(ob.id)!;
        decisions.push({ ...locked, status: 'LOCKED' });
        // Track committed USD for reporting, but do not double-deduct from working balances
        // because verified balances returned from Airwallex API already reflect executed payouts.
        totalCommittedUSD = CurrencyMath.add(totalCommittedUSD, locked.sourceAmountRequired).toNumber();
        continue;
      }

      const swiftFee = ob.transferMethod === 'SWIFT' 
        ? (ob.currency === 'EUR' ? TREASURY_POLICY_RULES.SWIFT_FLAT_FEE_EUR : TREASURY_POLICY_RULES.SWIFT_FLAT_FEE_GBP)
        : 0;

      const totalTargetRequired = CurrencyMath.add(ob.amount, swiftFee).toNumber();

      // Case 1: Target currency is USD
      if (ob.currency === 'USD') {
        const projectedUsdRemaining = CurrencyMath.subtract(workingBalances.USD, totalTargetRequired).toNumber();

        // Check reserve floor invariant
        if (projectedUsdRemaining >= reserveFloorUSD) {
          // Can safely fund from USD
          const requiresApproval = totalTargetRequired > autonomousLimitUSD || ob.forecastConfidence < confidenceThreshold;
          
          decisions.push({
            obligationId: ob.id,
            action: 'FUND',
            targetAmount: ob.amount,
            targetCurrency: 'USD',
            sourceAmountRequired: totalTargetRequired,
            sourceCurrency: 'USD',
            feeAmount: swiftFee,
            deferralPenaltyEstimate: 0,
            reasoning: `Sufficient USD balance available ($${workingBalances.USD.toLocaleString()}). Post-transfer balance ($${projectedUsdRemaining.toLocaleString()}) preserves mandatory reserve floor ($${reserveFloorUSD.toLocaleString()}).`,
            evidenceConfidence: ob.forecastConfidence,
            requiresHumanApproval: requiresApproval,
            approvalReason: requiresApproval 
              ? (totalTargetRequired > autonomousLimitUSD ? `Amount exceeds autonomous threshold ($${autonomousLimitUSD.toLocaleString()})` : `Evidence confidence (${ob.forecastConfidence}) below policy threshold (${confidenceThreshold})`)
              : undefined,
            status: 'PROPOSED',
          });

          workingBalances.USD = projectedUsdRemaining;
          totalCommittedUSD = CurrencyMath.add(totalCommittedUSD, totalTargetRequired).toNumber();
        } else {
          // Insufficient funds without breaching reserve floor
          if (ob.criticality === 'CRITICAL') {
            // Cannot defer a critical obligation unilaterally
            decisions.push({
              obligationId: ob.id,
              action: 'ESCALATE',
              targetAmount: ob.amount,
              targetCurrency: 'USD',
              sourceAmountRequired: totalTargetRequired,
              sourceCurrency: 'USD',
              feeAmount: swiftFee,
              deferralPenaltyEstimate: 2000.0, // port demurrage penalty
              reasoning: `CRITICAL obligation cannot be funded without violating the $${reserveFloorUSD.toLocaleString()} USD reserve floor (Shortfall: $${CurrencyMath.subtract(reserveFloorUSD, projectedUsdRemaining).toNumber()}). Automatic escalation triggered.`,
              evidenceConfidence: ob.forecastConfidence,
              requiresHumanApproval: true,
              approvalReason: 'Policy violation: Reserve floor breach required to pay critical supplier',
              status: 'PROPOSED',
            });
            policyViolations.push(`CRITICAL obligation ${ob.id} cannot be satisfied without breaching $${reserveFloorUSD.toLocaleString()} reserve floor.`);
          } else {
            // Defer cheapest candidate
            const penalty = ob.amount * 0.012; // 1.2% negotiated deferral fee
            decisions.push({
              obligationId: ob.id,
              action: 'DEFER',
              targetAmount: ob.amount,
              targetCurrency: 'USD',
              sourceAmountRequired: 0,
              sourceCurrency: 'USD',
              feeAmount: 0,
              deferralPenaltyEstimate: penalty,
              reasoning: `Deferred to preserve $${reserveFloorUSD.toLocaleString()} reserve floor. Supplier contract permits 7-14 day deferral with minimal negotiated penalty ($${penalty.toFixed(2)}).`,
              evidenceConfidence: ob.forecastConfidence,
              requiresHumanApproval: false,
              status: 'PROPOSED',
            });

            rejectedAlternatives.push({
              obligationId: ob.id,
              alternativeAction: 'FUND',
              rejectionReason: `Direct funding would reduce USD reserve to $${projectedUsdRemaining.toLocaleString()}, violating the minimum reserve floor of $${reserveFloorUSD.toLocaleString()}.`,
              financialImpactUSD: totalTargetRequired,
            });
          }
        }
      } 
      // Case 2: Target currency is EUR or GBP
      else {
        const localBalance = workingBalances[ob.currency];

        // 2a. Can we fund directly from existing local currency wallet?
        if (localBalance >= totalTargetRequired) {
          workingBalances[ob.currency] = CurrencyMath.subtract(localBalance, totalTargetRequired).toNumber();
          const usdEq = CurrencyMath.toUsdEquivalent(totalTargetRequired, ob.currency, ratesMap);
          totalCommittedUSD = CurrencyMath.add(totalCommittedUSD, usdEq).toNumber();

          decisions.push({
            obligationId: ob.id,
            action: 'FUND',
            targetAmount: ob.amount,
            targetCurrency: ob.currency,
            sourceAmountRequired: totalTargetRequired,
            sourceCurrency: ob.currency,
            feeAmount: swiftFee,
            deferralPenaltyEstimate: 0,
            reasoning: `Funded directly from existing ${ob.currency} wallet balance (${localBalance.toLocaleString()} ${ob.currency} available). Includes ${swiftFee} ${ob.currency} ${ob.transferMethod} fee.`,
            evidenceConfidence: ob.forecastConfidence,
            requiresHumanApproval: false,
            status: 'PROPOSED',
          });
        } 
        // 2b. Need FX conversion from USD
        else {
          // Deficit needed in target currency
          const targetDeficit = CurrencyMath.subtract(totalTargetRequired, localBalance).toNumber();
          const rateKey = `${ob.currency}_USD`;
          const fxRate = ratesMap[rateKey] || (ob.currency === 'EUR' ? 1.0877 : 1.2982);

          // Calculate USD required to convert target deficit
          const conversionCost = CurrencyMath.calculateConversionCost(targetDeficit, fxRate);
          const requiredUsdCost = conversionCost.sourceAmountRequired;
          const projectedUsdRemaining = CurrencyMath.subtract(workingBalances.USD, requiredUsdCost).toNumber();

          if (projectedUsdRemaining >= reserveFloorUSD) {
            // Can execute FX conversion safely!
            const requiresApproval = requiredUsdCost > autonomousLimitUSD || ob.forecastConfidence < confidenceThreshold;

            decisions.push({
              obligationId: ob.id,
              action: 'CONVERT_AND_FUND',
              targetAmount: ob.amount,
              targetCurrency: ob.currency,
              sourceAmountRequired: requiredUsdCost,
              sourceCurrency: 'USD',
              fxRateUsed: fxRate,
              feeAmount: swiftFee,
              deferralPenaltyEstimate: 0,
              reasoning: `Convert $${requiredUsdCost.toLocaleString()} USD -> ${targetDeficit.toLocaleString()} ${ob.currency} at locked rate ${fxRate}. Covers obligation + ${swiftFee} ${ob.currency} flat SWIFT fee. USD balance after conversion ($${projectedUsdRemaining.toLocaleString()}) preserves $${reserveFloorUSD.toLocaleString()} reserve floor.`,
              evidenceConfidence: ob.forecastConfidence,
              requiresHumanApproval: requiresApproval,
              approvalReason: requiresApproval 
                ? (requiredUsdCost > autonomousLimitUSD ? `Conversion exceeds autonomous ceiling ($${autonomousLimitUSD.toLocaleString()})` : `Confidence (${ob.forecastConfidence}) requires validation`)
                : undefined,
              status: 'PROPOSED',
            });

            // Update working balances
            workingBalances.USD = projectedUsdRemaining;
            workingBalances[ob.currency] = 0; // consumed existing balance + converted deficit
            totalCommittedUSD = CurrencyMath.add(totalCommittedUSD, requiredUsdCost).toNumber();
          } else {
            // Cannot convert without violating reserve floor
            if (ob.criticality === 'CRITICAL' || ob.criticality === 'HIGH') {
              decisions.push({
                obligationId: ob.id,
                action: 'ESCALATE',
                targetAmount: ob.amount,
                targetCurrency: ob.currency,
                sourceAmountRequired: requiredUsdCost,
                sourceCurrency: 'USD',
                fxRateUsed: fxRate,
                feeAmount: swiftFee,
                deferralPenaltyEstimate: ob.amount * 0.05,
                reasoning: `${ob.criticality} priority obligation cannot be funded or converted without violating reserve floor (Deficit in USD: $${CurrencyMath.subtract(reserveFloorUSD, projectedUsdRemaining).toNumber()}). Escalated to treasury committee.`,
                evidenceConfidence: ob.forecastConfidence,
                requiresHumanApproval: true,
                approvalReason: 'Reserve floor limit breach on foreign currency conversion',
                status: 'PROPOSED',
              });
              policyViolations.push(`Obligation ${ob.id} (${ob.supplier}) requires FX conversion of $${requiredUsdCost.toLocaleString()} USD which violates reserve floor.`);
            } else {
              // Defer
              decisions.push({
                obligationId: ob.id,
                action: 'DEFER',
                targetAmount: ob.amount,
                targetCurrency: ob.currency,
                sourceAmountRequired: 0,
                sourceCurrency: 'USD',
                feeAmount: 0,
                deferralPenaltyEstimate: 0,
                reasoning: `Deferred to preserve liquidity. Non-critical obligation with 60h deadline. No immediate operational shutdown risk.`,
                evidenceConfidence: ob.forecastConfidence,
                requiresHumanApproval: false,
                status: 'PROPOSED',
              });

              rejectedAlternatives.push({
                obligationId: ob.id,
                alternativeAction: 'CONVERT_AND_FUND',
                rejectionReason: `Converting $${requiredUsdCost.toLocaleString()} USD would push USD cash to $${projectedUsdRemaining.toLocaleString()}, below the $${reserveFloorUSD.toLocaleString()} reserve floor.`,
                financialImpactUSD: requiredUsdCost,
              });
            }
          }
        }
      }
    }

    // Calculate total obligations in USD equivalent
    let totalObligationsUSD = 0;
    for (const ob of obligations) {
      totalObligationsUSD = CurrencyMath.add(
        totalObligationsUSD,
        CurrencyMath.toUsdEquivalent(ob.amount, ob.currency, ratesMap)
      ).toNumber();
    }

    const availableCashUSD = initialUsdAvailable;
    const projectedEndingBufferUSD = workingBalances.USD;

    const summary = {
      fundedCount: decisions.filter(d => d.action === 'FUND').length,
      convertedCount: decisions.filter(d => d.action === 'CONVERT_AND_FUND').length,
      deferredCount: decisions.filter(d => d.action === 'DEFER').length,
      escalatedCount: decisions.filter(d => d.action === 'ESCALATE').length,
      totalCashCommittedUSD: totalCommittedUSD,
    };

    return {
      planId: `PLAN-${Date.now()}-${uuidv4().substring(0, 6)}`,
      version: 1,
      timestamp: new Date().toISOString(),
      totalObligationsUSD,
      availableCashUSD,
      reserveFloorUSD,
      projectedEndingBufferUSD,
      decisions,
      summary,
      isCompliant: policyViolations.length === 0,
      policyViolations,
      rejectedAlternatives,
    };
  }
}
