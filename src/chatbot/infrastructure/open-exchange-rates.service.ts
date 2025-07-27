import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { throwError } from 'rxjs';
import {
  ICurrencyService,
  ConversionRequest,
  CurrencyInfo,
} from '../interfaces';
import { CurrencyConversion } from '../entities';

interface OpenExchangeRatesLatestResponse {
  disclaimer: string;
  license: string;
  timestamp: number;
  base: string;
  rates: Record<string, number>;
}

interface OpenExchangeRatesCurrenciesResponse {
  [currencyCode: string]: string;
}

/**
 * Open Exchange Rates API implementation
 * Provides real-time currency conversion with caching and robust error handling
 */
@Injectable()
export class OpenExchangeRatesService implements ICurrencyService {
  private readonly logger = new Logger(OpenExchangeRatesService.name);
  private readonly appId: string;
  private readonly cacheTtl: number;
  private readonly baseUrl = 'https://openexchangerates.org/api';
  private readonly requestTimeout = 10000;

  private readonly ratesCache = new Map<
    string,
    { data: number; timestamp: number }
  >();
  private currenciesCache: CurrencyInfo[] | null = null;
  private currenciesCacheTimestamp = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.appId = this.configService.get<string>('exchangeRates.apiKey')!;
    this.cacheTtl =
      this.configService.get<number>('exchangeRates.cacheTtl')! * 1000;
    this.httpService.axiosRef.defaults.timeout = this.requestTimeout;
  }

  /**
   * Convert amount between currencies with validation
   */
  async convertCurrency(
    request: ConversionRequest,
  ): Promise<CurrencyConversion> {
    try {
      this.validateConversionRequest(request);
      const { amount, fromCurrency, toCurrency } = request;

      // Handle same currency conversion
      if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
        return new CurrencyConversion({
          amount,
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
          convertedAmount: amount,
          exchangeRate: 1,
          timestamp: new Date().toISOString(),
          source: 'direct',
        });
      }

      const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
      const convertedAmount = this.roundToDecimalPlaces(
        amount * exchangeRate,
        4,
      );

      return new CurrencyConversion({
        amount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        convertedAmount,
        exchangeRate,
        timestamp: new Date().toISOString(),
        source: 'openexchangerates.org',
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? `Currency conversion failed: ${error.message}`
          : 'Currency conversion failed: Unknown error';

      this.logger.error(errorMessage, {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * Get exchange rate between two currencies with caching
   * Uses Open Exchange Rates latest.json endpoint with base currency conversion
   */
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    const cacheKey = `${from}-${to}`;

    // Check cache first
    const cached = this.ratesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      this.logger.debug(
        `Using cached exchange rate for ${cacheKey}: ${cached.data}`,
      );
      return cached.data;
    }

    try {
      const url = `${this.baseUrl}/latest.json`;
      const params = { app_id: this.appId, symbols: `${from},${to}` };

      this.logger.debug(`Fetching exchange rates for ${cacheKey}`);

      const response = await firstValueFrom(
        this.httpService
          .get<OpenExchangeRatesLatestResponse>(url, { params })
          .pipe(
            timeout(this.requestTimeout),
            catchError((error: unknown) => {
              this.logger.error(`HTTP request failed for ${cacheKey}`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                status: this.getErrorStatus(error),
                statusText: this.getErrorStatusText(error),
              });
              return throwError(() => error);
            }),
          ),
      );

      const { rates, base } = response.data;
      if (!rates || Object.keys(rates).length === 0) {
        throw new Error('No exchange rates returned from API');
      }

      let rate: number;
      if (from === base) {
        rate = rates[to];
        if (!rate) throw new Error(`Exchange rate not found for ${to}`);
      } else if (to === base) {
        const fromRate = rates[from];
        if (!fromRate) throw new Error(`Exchange rate not found for ${from}`);
        rate = 1 / fromRate;
      } else {
        const fromRate = rates[from];
        const toRate = rates[to];
        if (!fromRate || !toRate) {
          throw new Error(
            `Exchange rates not found for ${!fromRate ? from : to}`,
          );
        }
        rate = toRate / fromRate;
      }

      if (!rate || rate <= 0 || !Number.isFinite(rate)) {
        throw new Error(`Invalid exchange rate calculated: ${rate}`);
      }

      // Cache the successful result
      this.ratesCache.set(cacheKey, { data: rate, timestamp: Date.now() });
      this.logger.debug(
        `Successfully fetched and cached exchange rate for ${cacheKey}: ${rate}`,
      );
      return rate;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? `Failed to get exchange rate from ${from} to ${to}: ${error.message}`
          : `Failed to get exchange rate from ${from} to ${to}: Unknown error`;

      this.logger.error(errorMessage, {
        fromCurrency: from,
        toCurrency: to,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseData: this.getErrorResponseData(error),
      });

      throw new Error(errorMessage);
    }
  }

  /**
   * Get list of supported currencies with caching
   * Uses Open Exchange Rates currencies.json endpoint
   */
  async getSupportedCurrencies(): Promise<CurrencyInfo[]> {
    // Return cached currencies if valid
    if (
      this.currenciesCache &&
      Date.now() - this.currenciesCacheTimestamp < this.cacheTtl
    ) {
      return this.currenciesCache;
    }

    try {
      const url = `${this.baseUrl}/currencies.json`;
      const params = { app_id: this.appId };

      const response = await firstValueFrom(
        this.httpService
          .get<OpenExchangeRatesCurrenciesResponse>(url, { params })
          .pipe(timeout(this.requestTimeout)),
      );

      const currencies: CurrencyInfo[] = Object.entries(
        response.data || {},
      ).map(([code, name]) => ({
        code: code.toUpperCase(),
        name: name || code,
        symbol: this.getCurrencySymbol(code),
      }));

      if (currencies.length === 0) {
        throw new Error('No currencies returned from API');
      }

      // Cache the result
      this.currenciesCache = currencies;
      this.currenciesCacheTimestamp = Date.now();

      this.logger.log(`Loaded ${currencies.length} supported currencies`);
      return currencies;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get supported currencies: ${errorMessage}`);

      // Return fallback currencies if API fails
      const fallbackCurrencies = this.getFallbackCurrencies();
      this.logger.warn(
        `Using fallback currencies (${fallbackCurrencies.length} currencies)`,
      );
      return fallbackCurrencies;
    }
  }

  /**
   * Check if currency is supported with validation
   */
  async isCurrencySupported(currencyCode: string): Promise<boolean> {
    if (!currencyCode?.trim() || currencyCode.length !== 3) {
      return false;
    }

    try {
      const currencies = await this.getSupportedCurrencies();
      return currencies.some((c) => c.code === currencyCode.toUpperCase());
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Could not verify currency support: ${errorMessage}`);

      // Fallback to common currencies check
      const commonCurrencies = [
        'USD',
        'EUR',
        'GBP',
        'JPY',
        'CAD',
        'AUD',
        'CHF',
        'CNY',
        'INR',
        'KRW',
      ];
      return commonCurrencies.includes(currencyCode.toUpperCase());
    }
  }

  /**
   * Check if service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Quick health check with common currency pair
      await this.getExchangeRate('USD', 'EUR');
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Currency service unavailable: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Validate conversion request parameters
   */
  private validateConversionRequest(request: ConversionRequest): void {
    const { amount, fromCurrency, toCurrency } = request;

    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      throw new Error('Amount must be a positive finite number');
    }
    if (amount > 1000000000) {
      throw new Error('Amount too large (max: 1,000,000,000)');
    }
    if (!fromCurrency?.trim() || fromCurrency.length !== 3) {
      throw new Error('From currency must be a valid 3-letter currency code');
    }
    if (!toCurrency?.trim() || toCurrency.length !== 3) {
      throw new Error('To currency must be a valid 3-letter currency code');
    }
  }

  /**
   * Round number to specified decimal places
   */
  private roundToDecimalPlaces(value: number, decimals: number): number {
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
  }

  /**
   * Safely extract error status from unknown error
   */
  private getErrorStatus(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { status?: number } }).response;
      return response?.status;
    }
    return undefined;
  }

  /**
   * Safely extract error status text from unknown error
   */
  private getErrorStatusText(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { statusText?: string } })
        .response;
      return response?.statusText;
    }
    return undefined;
  }

  /**
   * Safely extract error response data from unknown error
   */
  private getErrorResponseData(error: unknown): unknown {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { data?: unknown } }).response;
      return response?.data;
    }
    return undefined;
  }

  /**
   * Get currency symbol for common currencies
   */
  private getCurrencySymbol(code: string): string | undefined {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CAD: 'C$',
      AUD: 'A$',
      CHF: 'CHF',
      CNY: '¥',
      INR: '₹',
      KRW: '₩',
      BRL: 'R$',
      MXN: '$',
      SEK: 'kr',
      NOK: 'kr',
      DKK: 'kr',
      PLN: 'zł',
      CZK: 'Kč',
      HUF: 'Ft',
      RUB: '₽',
      ZAR: 'R',
      SGD: 'S$',
      HKD: 'HK$',
      NZD: 'NZ$',
      TRY: '₺',
      ILS: '₪',
      AED: 'د.إ',
      SAR: '﷼',
      EGP: 'E£',
      THB: '฿',
      MYR: 'RM',
      IDR: 'Rp',
      PHP: '₱',
      VND: '₫',
    };
    return symbols[code.toUpperCase()];
  }

  /**
   * Fallback currencies when API is unavailable
   */
  private getFallbackCurrencies(): CurrencyInfo[] {
    return [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
      { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
      { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
      { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
      { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
      { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
      { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
      { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
      { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
      { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
      { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
    ];
  }
}
