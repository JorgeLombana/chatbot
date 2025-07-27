import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsNumber, Min, Length } from 'class-validator';
import { OpenExchangeRatesService } from '../infrastructure/open-exchange-rates.service';
import { ConversionRequest } from '../interfaces';

/**
 * DTO for currency conversion test request
 */
class CurrencyConversionTestDto implements ConversionRequest {
  @ApiProperty({
    description: 'Amount to convert',
    example: 100,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Source currency code (3 letters)',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({
    description: 'Target currency code (3 letters)',
    example: 'EUR',
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  @Length(3, 3)
  toCurrency: string;
}

/**
 * Test controller for validating currency service functionality
 * Provides endpoints to test Open Exchange Rates API integration
 */
@ApiTags('Currency Service Tests')
@Controller('test/currency')
export class CurrencyTestController {
  private readonly logger = new Logger(CurrencyTestController.name);

  constructor(private readonly currencyService: OpenExchangeRatesService) {}

  /**
   * Test currency conversion endpoint
   */
  @Post('convert')
  @ApiOperation({
    summary: 'Test currency conversion',
    description:
      'Convert amount between two currencies using Open Exchange Rates API',
  })
  @ApiBody({
    type: CurrencyConversionTestDto,
    description: 'Currency conversion parameters',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful conversion',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            amount: { type: 'number', example: 100 },
            fromCurrency: { type: 'string', example: 'USD' },
            toCurrency: { type: 'string', example: 'EUR' },
            convertedAmount: { type: 'number', example: 92.35 },
            exchangeRate: { type: 'number', example: 0.9235 },
            timestamp: { type: 'string', example: '2025-01-26T22:30:00.000Z' },
            source: { type: 'string', example: 'openexchangerates.org' },
          },
        },
        executionTime: { type: 'string', example: '245ms' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Currency service error',
  })
  async testConversion(@Body() request: CurrencyConversionTestDto) {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Testing currency conversion: ${request.amount} ${request.fromCurrency} -> ${request.toCurrency}`,
      );

      const result = await this.currencyService.convertCurrency(request);
      const executionTime = `${Date.now() - startTime}ms`;

      this.logger.log(
        `Conversion successful: ${result.getFormattedConversion()} (${executionTime})`,
      );

      return {
        success: true,
        data: {
          amount: result.amount,
          fromCurrency: result.fromCurrency,
          toCurrency: result.toCurrency,
          convertedAmount: result.convertedAmount,
          exchangeRate: result.exchangeRate,
          timestamp: result.timestamp,
          source: result.source,
          formattedConversion: result.getFormattedConversion(),
          exchangeRateDescription: result.getExchangeRateDescription(),
          summary: result.getSummary(),
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Conversion failed: ${errorMessage} (${executionTime})`,
      );

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test exchange rate retrieval
   */
  @Get('rate')
  @ApiOperation({
    summary: 'Get exchange rate between currencies',
    description: 'Get current exchange rate from Open Exchange Rates API',
  })
  @ApiQuery({
    name: 'from',
    description: 'Source currency code',
    example: 'USD',
  })
  @ApiQuery({
    name: 'to',
    description: 'Target currency code',
    example: 'EUR',
  })
  @ApiResponse({
    status: 200,
    description: 'Exchange rate retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            fromCurrency: { type: 'string', example: 'USD' },
            toCurrency: { type: 'string', example: 'EUR' },
            exchangeRate: { type: 'number', example: 0.9235 },
            description: { type: 'string', example: '1 USD = 0.9235 EUR' },
          },
        },
        executionTime: { type: 'string', example: '123ms' },
      },
    },
  })
  async testExchangeRate(
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string,
  ) {
    const startTime = Date.now();

    try {
      if (!fromCurrency || !toCurrency) {
        throw new HttpException(
          'Both "from" and "to" query parameters are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (fromCurrency.length !== 3 || toCurrency.length !== 3) {
        throw new HttpException(
          'Currency codes must be exactly 3 characters long',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Testing exchange rate: ${fromCurrency} -> ${toCurrency}`,
      );

      const rate = await this.currencyService.getExchangeRate(
        fromCurrency,
        toCurrency,
      );
      const executionTime = `${Date.now() - startTime}ms`;

      this.logger.log(
        `Exchange rate retrieved: 1 ${fromCurrency.toUpperCase()} = ${rate} ${toCurrency.toUpperCase()} (${executionTime})`,
      );

      return {
        success: true,
        data: {
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
          exchangeRate: rate,
          description: `1 ${fromCurrency.toUpperCase()} = ${rate.toFixed(4)} ${toCurrency.toUpperCase()}`,
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Exchange rate failed: ${errorMessage} (${executionTime})`,
      );

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test supported currencies endpoint
   */
  @Get('currencies')
  @ApiOperation({
    summary: 'Get supported currencies',
    description:
      'Retrieve list of all supported currencies from Open Exchange Rates',
  })
  @ApiResponse({
    status: 200,
    description: 'Supported currencies retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            currencies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'USD' },
                  name: { type: 'string', example: 'United States Dollar' },
                  symbol: { type: 'string', example: '$' },
                },
              },
            },
            total: { type: 'number', example: 170 },
          },
        },
        executionTime: { type: 'string', example: '89ms' },
      },
    },
  })
  async testSupportedCurrencies() {
    const startTime = Date.now();

    try {
      this.logger.log('Testing supported currencies retrieval');

      const currencies = await this.currencyService.getSupportedCurrencies();
      const executionTime = `${Date.now() - startTime}ms`;

      this.logger.log(
        `Retrieved ${currencies.length} supported currencies (${executionTime})`,
      );

      return {
        success: true,
        data: {
          currencies: currencies.slice(0, 20), // Show first 20 for readability
          total: currencies.length,
          sample:
            currencies.length > 20
              ? 'Showing first 20 currencies'
              : 'All currencies shown',
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Currencies retrieval failed: ${errorMessage} (${executionTime})`,
      );

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test currency support check
   */
  @Get('check')
  @ApiOperation({
    summary: 'Check if currency is supported',
    description: 'Verify if a currency code is supported by the service',
  })
  @ApiQuery({
    name: 'currency',
    description: 'Currency code to check',
    example: 'USD',
  })
  @ApiResponse({
    status: 200,
    description: 'Currency support check result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            currency: { type: 'string', example: 'USD' },
            supported: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Currency USD is supported' },
          },
        },
        executionTime: { type: 'string', example: '45ms' },
      },
    },
  })
  async testCurrencySupport(@Query('currency') currency: string) {
    const startTime = Date.now();

    try {
      if (!currency) {
        throw new HttpException(
          'Currency query parameter is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (currency.length !== 3) {
        throw new HttpException(
          'Currency code must be exactly 3 characters long',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Testing currency support: ${currency}`);

      const isSupported =
        await this.currencyService.isCurrencySupported(currency);
      const executionTime = `${Date.now() - startTime}ms`;

      const message = isSupported
        ? `Currency ${currency.toUpperCase()} is supported`
        : `Currency ${currency.toUpperCase()} is not supported`;

      this.logger.log(`${message} (${executionTime})`);

      return {
        success: true,
        data: {
          currency: currency.toUpperCase(),
          supported: isSupported,
          message,
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Currency support check failed: ${errorMessage} (${executionTime})`,
      );

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test service availability
   */
  @Get('health')
  @ApiOperation({
    summary: 'Check currency service health',
    description:
      'Verify if the Open Exchange Rates service is available and working',
  })
  @ApiResponse({
    status: 200,
    description: 'Service health check result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            available: { type: 'boolean', example: true },
            status: { type: 'string', example: 'Service is available' },
            timestamp: { type: 'string', example: '2025-01-26T22:30:00.000Z' },
          },
        },
        executionTime: { type: 'string', example: '156ms' },
      },
    },
  })
  async testServiceHealth() {
    const startTime = Date.now();

    try {
      this.logger.log('Testing currency service health');

      const isAvailable = await this.currencyService.isAvailable();
      const executionTime = `${Date.now() - startTime}ms`;

      const status = isAvailable
        ? 'Service is available and working'
        : 'Service is currently unavailable';

      this.logger.log(`Health check: ${status} (${executionTime})`);

      return {
        success: true,
        data: {
          available: isAvailable,
          status,
          timestamp: new Date().toISOString(),
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Health check failed: ${errorMessage} (${executionTime})`,
      );

      return {
        success: false,
        data: {
          available: false,
          status: `Service check failed: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        },
        executionTime,
      };
    }
  }

  /**
   * Get multiple conversion rates at once
   */
  @Post('batch-convert')
  @ApiOperation({
    summary: 'Test batch currency conversions',
    description: 'Convert multiple amounts and currency pairs in one request',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        conversions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              amount: { type: 'number', example: 100 },
              fromCurrency: { type: 'string', example: 'USD' },
              toCurrency: { type: 'string', example: 'EUR' },
            },
          },
        },
      },
    },
  })
  async testBatchConversion(
    @Body() request: { conversions: ConversionRequest[] },
  ) {
    const startTime = Date.now();

    try {
      if (!request.conversions || !Array.isArray(request.conversions)) {
        throw new HttpException(
          'Conversions array is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (request.conversions.length > 10) {
        throw new HttpException(
          'Maximum 10 conversions allowed per batch',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Testing batch conversion of ${request.conversions.length} requests`,
      );

      const results = await Promise.allSettled(
        request.conversions.map(async (conversion, index) => {
          try {
            const result =
              await this.currencyService.convertCurrency(conversion);
            return {
              index,
              success: true,
              data: {
                amount: result.amount,
                fromCurrency: result.fromCurrency,
                toCurrency: result.toCurrency,
                convertedAmount: result.convertedAmount,
                exchangeRate: result.exchangeRate,
                formattedConversion: result.getFormattedConversion(),
              },
            };
          } catch (error) {
            return {
              index,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }),
      );

      const executionTime = `${Date.now() - startTime}ms`;
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success,
      ).length;
      const failed = results.length - successful;

      this.logger.log(
        `Batch conversion completed: ${successful} successful, ${failed} failed (${executionTime})`,
      );

      return {
        success: true,
        data: {
          results: results.map((r) =>
            r.status === 'fulfilled' ? r.value : { error: 'Request failed' },
          ),
          summary: {
            total: results.length,
            successful,
            failed,
          },
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Batch conversion failed: ${errorMessage} (${executionTime})`,
      );

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
