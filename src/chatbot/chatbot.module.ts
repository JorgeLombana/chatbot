import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ChatbotController } from './controllers/chatbot.controller';
import { CurrencyTestController } from './controllers/currency-test.controller';
import { ProductTestController } from './controllers/product-test.controller';
import { LLMService } from './services/llm.service';
import { OpenExchangeRatesService } from './infrastructure/open-exchange-rates.service';
import { CSVProductRepository } from './infrastructure/csv-product.repository';

/**
 * Chatbot feature module
 * Handles chatbot functionality with tool integration for product search and currency conversion
 * Implements the 4-step LLM pipeline: receive → analyze → execute tool → respond
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    ConfigModule,
  ],
  controllers: [
    ChatbotController,
    CurrencyTestController,
    ProductTestController,
  ],
  providers: [
    LLMService,
    OpenExchangeRatesService,
    CSVProductRepository,
    // Abstract interfaces to concrete implementations
    {
      provide: 'ICurrencyService',
      useClass: OpenExchangeRatesService,
    },
    {
      provide: 'IProductRepository',
      useClass: CSVProductRepository,
    },
    {
      provide: 'ILLMService',
      useClass: LLMService,
    },
  ],
  exports: [
    LLMService,
    OpenExchangeRatesService,
    CSVProductRepository,
    'ICurrencyService',
    'IProductRepository',
    'ILLMService',
  ],
})
export class ChatbotModule {}
