import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { LLMService } from '../services/llm.service';
import { ChatRequestDto, ChatResponseDto } from '../dto';
import { LLMChatRequest } from '../interfaces';

/**
 * Main chatbot controller implementing the OpenAI-powered chatbot API
 * Provides the primary endpoint for user interactions with tool integration
 */
@ApiTags('Chatbot')
@Controller('chatbot')
export class ChatbotController {
  private readonly logger = new Logger(ChatbotController.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Main chat endpoint - processes user queries with AI assistant
   * Supports product search and currency conversion through function calling
   */
  @Post('chat')
  @ApiOperation({
    summary: 'Chat with AI assistant',
    description: `
Process user queries using OpenAI with function calling capabilities.

**Available Tools:**
- **searchProducts**: Find products from CSV data (returns exactly 2 relevant products)
- **convertCurrencies**: Real-time currency conversion using Open Exchange Rates API

**Supported Query Examples:**
- "I am looking for a phone"
- "I am looking for a present for my dad"
- "How much does a watch cost?"
- "What is the price of the watch in Euros?"
- "How many Canadian Dollars are 350 Euros?"

The system implements a 4-step pipeline:
1. **Receive** user query
2. **Analyze** query and determine required tools
3. **Execute** tools (searchProducts/convertCurrencies)
4. **Respond** with natural language incorporating tool results
    `,
  })
  @ApiBody({
    type: ChatRequestDto,
    description: 'Chat request with user query',
    examples: {
      productSearch: {
        summary: 'Product Search Query',
        description: 'Search for products in the catalog',
        value: {
          query: 'I am looking for a phone',
        },
      },
      giftRecommendation: {
        summary: 'Gift Recommendation',
        description: 'Get personalized gift suggestions',
        value: {
          query: 'I am looking for a present for my dad',
        },
      },
      priceInquiry: {
        summary: 'Price Inquiry',
        description: 'Ask about product pricing',
        value: {
          query: 'How much does a watch cost?',
        },
      },
      currencyConversion: {
        summary: 'Currency Conversion',
        description: 'Convert prices to different currencies',
        value: {
          query: 'What is the price of the watch in Euros?',
        },
      },
      directConversion: {
        summary: 'Direct Currency Conversion',
        description: 'Convert specific amounts between currencies',
        value: {
          query: 'How many Canadian Dollars are 350 Euros?',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successful chat response',
    type: ChatResponseDto,
    schema: {
      example: {
        response:
          'I found 2 phones for you:\n\n1. **iPhone 14 Pro** - Technology\n   - Price: $999.00 USD\n   - Has discount: No\n   - Summary: Latest iPhone with advanced camera system\n\n2. **Samsung Galaxy S23** - Technology\n   - Price: $799.00 USD\n   - Has discount: Yes\n   - Summary: Premium Android smartphone with excellent display\n\nBoth phones offer great features. The Samsung Galaxy S23 is currently on sale!',
        conversationId: 'chat-1732659600000-a1b2c3d4',
        toolUsed: 'searchProducts',
        finishReason: 'tool_calls',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - missing or empty query',
    schema: {
      example: {
        success: false,
        error: 'Query is required and cannot be empty',
        statusCode: 400,
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - LLM service unavailable',
    schema: {
      example: {
        success: false,
        error: 'Failed to process chat request: OpenAI API error',
        statusCode: 500,
      },
    },
  })
  async chat(@Body() chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
    const startTime = Date.now();

    try {
      // Validate request
      if (!chatRequest.query?.trim()) {
        throw new HttpException(
          'Query is required and cannot be empty',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Processing chat request: "${chatRequest.query.substring(0, 100)}..."`,
      );

      // Prepare LLM request
      const llmRequest: LLMChatRequest = {
        userQuery: chatRequest.query.trim(),
        conversationId: chatRequest.conversationId,
        messages: chatRequest.messages || [],
      };

      // Process with LLM service
      const llmResponse = await this.llmService.chat(llmRequest);
      const executionTime = Date.now() - startTime;

      this.logger.log(
        `Chat request completed in ${executionTime}ms, tool used: ${llmResponse.toolUsed || 'none'}`,
      );

      const response = {
        response: llmResponse.response,
        conversationId: llmResponse.conversationId,
        toolUsed: llmResponse.toolUsed,
        finishReason: llmResponse.finishReason,
        executionTimeMs: executionTime,
      };

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Chat request failed: ${errorMessage} (${executionTime}ms)`,
      );

      throw new HttpException(
        `Failed to process chat request: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  @ApiOperation({
    summary: 'Chatbot service health check',
    description: `
Check the health and availability of the chatbot service and its dependencies.

**Checks performed:**
- LLM service (OpenAI) availability
- Service initialization status
- Basic functionality test

This endpoint is useful for:
- Monitoring service health
- Debugging connectivity issues
- Verifying service readiness before making chat requests
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy and ready',
    schema: {
      example: {
        status: 'healthy',
        service: 'chatbot',
        llmService: {
          available: true,
          provider: 'OpenAI GPT-3.5-turbo',
        },
        capabilities: [
          'searchProducts (returns exactly 2 products from CSV)',
          'convertCurrencies (real-time rates via Open Exchange Rates)',
        ],
        timestamp: '2025-01-27T10:30:00.000Z',
        uptime: '2h 15m 30s',
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable - LLM service or dependencies down',
    schema: {
      example: {
        status: 'unhealthy',
        service: 'chatbot',
        llmService: {
          available: false,
          error: 'OpenAI API connection failed',
        },
        timestamp: '2025-01-27T10:30:00.000Z',
      },
    },
  })
  async getHealth() {
    const startTime = Date.now();

    try {
      this.logger.log('Performing chatbot health check');

      // Check LLM service availability
      const llmAvailable = await this.llmService.isAvailable();
      const checkTime = Date.now() - startTime;

      const healthStatus = {
        status: llmAvailable ? 'healthy' : 'unhealthy',
        service: 'chatbot',
        llmService: {
          available: llmAvailable,
          provider: 'OpenAI GPT-3.5-turbo',
          responseTime: `${checkTime}ms`,
        },
        capabilities: [
          'searchProducts (returns exactly 2 products from CSV)',
          'convertCurrencies (real-time rates via Open Exchange Rates)',
        ],
        availableTools: this.llmService.getAvailableTools().map((tool) => ({
          name: tool.function.name,
          description: tool.function.description,
        })),
        timestamp: new Date().toISOString(),
      };

      if (llmAvailable) {
        this.logger.log(`Health check passed in ${checkTime}ms`);
        return healthStatus;
      } else {
        this.logger.warn(
          `Health check failed - LLM service unavailable (${checkTime}ms)`,
        );
        // Create proper HttpException with string message and response object
        const response = {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Chatbot service unavailable - LLM service down',
          ...healthStatus,
        };
        throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
      }
    } catch (error) {
      const checkTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Health check failed after ${checkTime}ms: ${errorMessage}`,
      );

      const errorHealthStatus = {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Health check failed due to internal error',
        status: 'unhealthy',
        service: 'chatbot',
        llmService: {
          available: false,
          error: errorMessage,
          responseTime: `${checkTime}ms`,
        },
        capabilities: [
          'searchProducts (returns exactly 2 products from CSV)',
          'convertCurrencies (real-time rates via Open Exchange Rates)',
        ],
        timestamp: new Date().toISOString(),
      };

      throw new HttpException(
        errorHealthStatus,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
