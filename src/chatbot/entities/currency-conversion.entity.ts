import {
  IsString,
  IsNumber,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';

/**
 * Currency conversion domain entity
 * Represents a currency conversion operation with all relevant details
 */
export class CurrencyConversion {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @MaxLength(3)
  fromCurrency: string;

  @IsString()
  @MaxLength(3)
  toCurrency: string;

  @IsNumber()
  @Min(0)
  convertedAmount: number;

  @IsNumber()
  @Min(0)
  exchangeRate: number;

  @IsDateString()
  timestamp: string;

  @IsString()
  @MaxLength(50)
  source: string;

  constructor(data: Partial<CurrencyConversion> = {}) {
    this.amount = data.amount || 0;
    this.fromCurrency = data.fromCurrency?.toUpperCase() || '';
    this.toCurrency = data.toCurrency?.toUpperCase() || '';
    this.convertedAmount = data.convertedAmount || 0;
    this.exchangeRate = data.exchangeRate || 0;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.source = data.source || 'unknown';
  }

  /**
   * Get formatted conversion string for display
   * @returns Human-readable conversion description
   */
  getFormattedConversion(): string {
    return `${this.amount} ${this.fromCurrency} = ${this.convertedAmount.toFixed(2)} ${this.toCurrency}`;
  }

  /**
   * Get exchange rate description
   * @returns Exchange rate with context
   */
  getExchangeRateDescription(): string {
    return `1 ${this.fromCurrency} = ${this.exchangeRate.toFixed(4)} ${this.toCurrency}`;
  }

  /**
   * Check if conversion is recent (within last hour)
   * @returns Boolean indicating if conversion is fresh
   */
  isRecent(): boolean {
    const conversionTime = new Date(this.timestamp);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return conversionTime > oneHourAgo;
  }

  /**
   * Get full conversion summary with rate and timestamp
   * @returns Complete conversion description
   */
  getSummary(): string {
    const formattedTime = new Date(this.timestamp).toLocaleString();
    return `${this.getFormattedConversion()} (Rate: ${this.getExchangeRateDescription()}) - ${formattedTime}`;
  }

  /**
   * Calculate reverse conversion amount
   * @returns Amount in original currency
   */
  getReverseAmount(): number {
    return this.convertedAmount / this.exchangeRate;
  }
}
