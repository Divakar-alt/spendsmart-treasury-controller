import Decimal from 'decimal.js';
import { SupportedCurrency } from '../types/airwallex';

// Configure Decimal precision for fintech-grade calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class CurrencyMath {
  /**
   * Safe addition
   */
  static add(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).plus(new Decimal(b));
  }

  /**
   * Safe subtraction
   */
  static subtract(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).minus(new Decimal(b));
  }

  /**
   * Safe multiplication
   */
  static multiply(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).times(new Decimal(b));
  }

  /**
   * Safe division
   */
  static divide(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).dividedBy(new Decimal(b));
  }

  /**
   * Convert amount in major units to 2-decimal rounded number
   */
  static round2(val: number | string | Decimal): number {
    return new Decimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Compare two numbers (returns -1, 0, 1)
   */
  static compare(a: number | string | Decimal, b: number | string | Decimal): number {
    return new Decimal(a).comparedTo(new Decimal(b));
  }

  /**
   * Calculate required source currency amount to buy target amount with given FX rate and optional spread
   * E.g. To buy 10,212.85 EUR with rate 1.0877 USD per EUR => 10212.85 * 1.0877 USD
   */
  static calculateConversionCost(
    targetAmount: number,
    fxRate: number
  ): { sourceAmountRequired: number; targetAmountPurchased: number } {
    const target = new Decimal(targetAmount);
    const rate = new Decimal(fxRate);
    const source = target.times(rate);
    return {
      sourceAmountRequired: source.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      targetAmountPurchased: target.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    };
  }

  /**
   * Convert any currency amount to USD equivalent using reference rates
   */
  static toUsdEquivalent(amount: number, currency: SupportedCurrency, fxRates: Record<string, number>): number {
    if (currency === 'USD') return amount;
    const rateKey = `${currency}_USD`;
    const rate = fxRates[rateKey];
    if (!rate) {
      throw new Error(`Missing FX rate for conversion: ${rateKey}`);
    }
    return new Decimal(amount).times(new Decimal(rate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }
}
