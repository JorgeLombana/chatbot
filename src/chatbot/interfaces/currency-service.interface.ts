import { CurrencyConversion } from '../entities';

/**
 * Currency conversion request parameters
 */
export interface ConversionRequest {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
}

/**
 * Available currency information
 */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol?: string;
}

/**
 * Interface for currency conversion service
 * Defines the contract for currency operations and exchange rate management
 */
export interface ICurrencyService {
  /**
   * Convert amount between currencies
   * @param request - Conversion parameters
   * @returns Promise resolving to conversion result
   */
  convertCurrency(request: ConversionRequest): Promise<CurrencyConversion>;

  /**
   * Get current exchange rate between two currencies
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Promise resolving to exchange rate
   */
  getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number>;

  /**
   * Get list of supported currencies
   * @returns Promise resolving to array of supported currencies
   */
  getSupportedCurrencies(): Promise<CurrencyInfo[]>;

  /**
   * Check if a currency code is supported
   * @param currencyCode - Currency code to validate
   * @returns Promise resolving to boolean indicating support
   */
  isCurrencySupported(currencyCode: string): Promise<boolean>;

  /**
   * Check if the service is available and properly configured
   * @returns Promise resolving to boolean indicating availability
   */
  isAvailable(): Promise<boolean>;
}
