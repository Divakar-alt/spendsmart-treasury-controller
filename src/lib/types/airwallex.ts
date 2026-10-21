export type SupportedCurrency = 'USD' | 'EUR' | 'GBP';

export interface WalletBalance {
  currency: SupportedCurrency;
  available_amount: number;
  pending_amount: number;
  reserved_amount: number;
  total_amount: number;
}

export interface BalanceResponse {
  items: WalletBalance[];
  has_more: boolean;
}

export interface GlobalAccount {
  id: string;
  account_name: string;
  account_number: string;
  country_code: string;
  currency: SupportedCurrency;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
}

export interface FxRate {
  buy_currency: SupportedCurrency;
  sell_currency: SupportedCurrency;
  rate: number;
  client_rate?: number;
  timestamp: string;
}

export interface FxQuoteRequest {
  request_id: string;
  buy_currency: SupportedCurrency;
  sell_currency: SupportedCurrency;
  buy_amount?: number;
  sell_amount?: number;
  validity_in_seconds?: number;
}

export interface FxQuote {
  quote_id: string;
  request_id: string;
  buy_currency: SupportedCurrency;
  sell_currency: SupportedCurrency;
  buy_amount: number;
  sell_amount: number;
  client_rate: number;
  validity_in_seconds: number;
  created_at: string;
  expires_at: string;
}

export interface FxConversionRequest {
  request_id: string;
  buy_currency: SupportedCurrency;
  sell_currency: SupportedCurrency;
  buy_amount?: number;
  sell_amount?: number;
  quote_id?: string;
}

export interface FxConversion {
  conversion_id: string;
  request_id: string;
  quote_id?: string;
  buy_currency: SupportedCurrency;
  sell_currency: SupportedCurrency;
  buy_amount: number;
  sell_amount: number;
  rate: number;
  status: 'SETTLED' | 'PENDING' | 'CANCELLED';
  created_at: string;
}

export type TransferMethod = 'LOCAL' | 'SWIFT';

export interface BeneficiaryAddress {
  street_address: string;
  city: string;
  state?: string;
  postcode?: string;
  country_code: string;
}

export interface BeneficiaryBankDetails {
  account_number?: string;
  account_routing_type1?: 'aba' | 'sort_code' | string;
  account_routing_value1?: string;
  bank_account_category?: 'Checking' | 'Savings';
  bank_name?: string;
  iban?: string;
  swift_code?: string;
}

export interface Beneficiary {
  beneficiary_id: string;
  entity_type: 'COMPANY' | 'INDIVIDUAL';
  company_name: string;
  bank_details: BeneficiaryBankDetails;
  address: BeneficiaryAddress;
  transfer_methods: TransferMethod[];
}

export interface TransferRequest {
  request_id: string;
  beneficiary_id: string;
  transfer_amount: number;
  transfer_currency: SupportedCurrency;
  transfer_method: TransferMethod;
  reference?: string;
  reason?: string;
}

export type TransferStatus = 'NEW' | 'PENDING' | 'PROCESSING' | 'SENT' | 'PAID' | 'CANCELLED';

export interface Transfer {
  transfer_id: string;
  request_id: string;
  beneficiary_id: string;
  beneficiary_name?: string;
  transfer_amount: number;
  transfer_currency: SupportedCurrency;
  transfer_method: TransferMethod;
  status: TransferStatus;
  fee_amount: number;
  fee_currency: SupportedCurrency;
  failure_reason?: string;
  failure_type?: string;
  reference?: string;
  created_at: string;
  updated_at: string;
}

export interface DepositSimulationRequest {
  global_account_id: string;
  amount: number;
  payer_name?: string;
  currency?: SupportedCurrency;
}

export interface DepositSimulationResponse {
  status: 'PENDING' | 'SETTLED';
  amount: number;
  currency: SupportedCurrency;
  global_account_id: string;
  reference: string;
}
