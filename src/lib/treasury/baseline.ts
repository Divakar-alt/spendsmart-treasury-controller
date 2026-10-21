import { Obligation } from '../types/treasury';
import { WalletBalance, FxRate } from '../types/airwallex';

export const INITIAL_WALLET_BALANCES: WalletBalance[] = [
  {
    currency: 'USD',
    available_amount: 42000.0,
    pending_amount: 0.0,
    reserved_amount: 0.0,
    total_amount: 42000.0,
  },
  {
    currency: 'EUR',
    available_amount: 4000.0,
    pending_amount: 0.0,
    reserved_amount: 0.0,
    total_amount: 4000.0,
  },
  {
    currency: 'GBP',
    available_amount: 1500.0,
    pending_amount: 0.0,
    reserved_amount: 0.0,
    total_amount: 1500.0,
  },
];

export const TREASURY_POLICY_RULES = {
  MINIMUM_RESERVE_FLOOR_USD: 10000.0,
  AUTONOMOUS_EXECUTION_MAX_USD: 20000.0,
  AUTONOMOUS_CONFIDENCE_THRESHOLD: 0.85,
  SWIFT_FLAT_FEE_EUR: 12.85,
  SWIFT_FLAT_FEE_GBP: 15.00,
  FX_SPREAD_BPS: 25, // 0.25% FX markup
};

export const INITIAL_FX_RATES: FxRate[] = [
  {
    buy_currency: 'EUR',
    sell_currency: 'USD',
    rate: 1.085, // 1 EUR costs 1.085 USD
    client_rate: 1.0877, // with 25 bps spread
    timestamp: new Date().toISOString(),
  },
  {
    buy_currency: 'GBP',
    sell_currency: 'USD',
    rate: 1.295, // 1 GBP costs 1.295 USD
    client_rate: 1.2982,
    timestamp: new Date().toISOString(),
  },
  {
    buy_currency: 'USD',
    sell_currency: 'EUR',
    rate: 0.9216,
    client_rate: 0.9193,
    timestamp: new Date().toISOString(),
  },
  {
    buy_currency: 'USD',
    sell_currency: 'GBP',
    rate: 0.7722,
    client_rate: 0.7702,
    timestamp: new Date().toISOString(),
  },
];

export const INITIAL_OBLIGATIONS: Obligation[] = [
  {
    id: 'OBL-001-LOGISTICS',
    supplier: 'Apex Global Logistics & Freight',
    currency: 'USD',
    amount: 18500.0,
    deadlineHours: 12,
    criticality: 'CRITICAL',
    consequence: 'Immediate port demurrage ($2,000/day), customs clearance freeze, cargo stranded in port.',
    transferMethod: 'LOCAL',
    swiftFee: 0,
    evidence: 'Bill of Lading #BOL-9921 attached. Port of Long Beach release fee mandatory by 18:00 UTC.',
    forecastConfidence: 0.98,
    paymentStatus: 'UNPAID',
    beneficiaryAccountDetails: {
      accountNumber: '449102931',
      routingCode: '121000358', // Valid ABA
      bankName: 'Silicon Valley Commercial Bank',
      country: 'US',
    },
  },
  {
    id: 'OBL-002-CLOUD-INFRA',
    supplier: 'European Cloud Infrastructure AG',
    currency: 'EUR',
    amount: 14200.0,
    deadlineHours: 24,
    criticality: 'HIGH',
    consequence: 'Production database cluster throttled and failover nodes suspended with 5% SLA violation fee.',
    transferMethod: 'SWIFT',
    swiftFee: 12.85, // Flat fee mandated by Airwallex sandbox guide
    evidence: 'Invoice #INV-2026-EU-402 with signed master services agreement terms. Final notice before grace period ends.',
    forecastConfidence: 0.94,
    paymentStatus: 'UNPAID',
    beneficiaryAccountDetails: {
      accountNumber: 'DE89370400440532013000',
      routingCode: 'DBEUMM21XXX',
      bankName: 'Deutsche Bank Frankfurt',
      country: 'DE',
    },
  },
  {
    id: 'OBL-003-CHIP-IP',
    supplier: 'Apex Silicon IP Licensing Ltd',
    currency: 'GBP',
    amount: 9800.0,
    deadlineHours: 36,
    criticality: 'MEDIUM',
    consequence: 'Chip tape-out RTL license suspension. Vendor allows a 48h cure period without immediate penalty.',
    transferMethod: 'LOCAL',
    swiftFee: 0,
    evidence: 'Licensing milestone agreement #LIC-4410. Formal notice of payment due within 3 business days.',
    forecastConfidence: 0.88,
    paymentStatus: 'UNPAID',
    beneficiaryAccountDetails: {
      accountNumber: '88392019',
      routingCode: '200000', // Valid UK sort code format
      bankName: 'Barclays Bank UK',
      country: 'GB',
    },
  },
  {
    id: 'OBL-004-MATERIALS',
    supplier: 'Delta Advanced Materials Inc',
    currency: 'USD',
    amount: 22000.0,
    deadlineHours: 48,
    criticality: 'MEDIUM',
    consequence: 'Shipment batch rescheduled 10 business days. Deferral fee is only 1.2% ($264.00) under contract section 4.2.',
    transferMethod: 'LOCAL',
    swiftFee: 0,
    evidence: 'Purchase Order #PO-9812. Supplier confirmed via email that a 7-day deferral agreement is valid.',
    forecastConfidence: 0.91,
    paymentStatus: 'UNPAID',
    beneficiaryAccountDetails: {
      accountNumber: '992018231',
      routingCode: '021000021', // Chase ABA
      bankName: 'JPMorgan Chase Bank',
      country: 'US',
    },
  },
  {
    id: 'OBL-005-MEDIA-MARKETING',
    supplier: 'Horizon Global Media Group',
    currency: 'EUR',
    amount: 11500.0,
    deadlineHours: 60,
    criticality: 'LOW',
    consequence: 'Ad network retainer pause. Zero direct impact on operational fulfillment or manufacturing pipeline.',
    transferMethod: 'SWIFT',
    swiftFee: 12.85,
    evidence: 'Marketing Statement of Work #SOW-2026-M. Clause allows payment within 30 net days upon written deferral notice.',
    forecastConfidence: 0.65,
    paymentStatus: 'UNPAID',
    beneficiaryAccountDetails: {
      accountNumber: 'FR7630006000011234567890189',
      routingCode: 'BNPAFR22XXX',
      bankName: 'BNP Paribas Paris',
      country: 'FR',
    },
  },
];

export const SIMULATED_CUSTOMER_DEPOSIT = {
  amount: 35000.0,
  currency: 'USD' as const,
  globalAccountId: 'ga_us_treasury_01',
  payerName: 'Enterprise Client Acme Corp - Q4 Annual Settlement',
  reference: 'DEP-SIM-2026-904',
};
