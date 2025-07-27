import {
  Controller,
  Post,
  Body,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import { LLMService } from '../services/llm.service';
import { ChatRequestDto, ChatResponseDto } from '../dto';
import { LLMChatRequest } from '../interfaces';

/**
 * Main chatbot controller implementing the OpenAI-powered chatbot API
 * Provides the primary endpoint for user interactions with tool integration
 */
@ApiTags('Chatbot')
@Controller('chatbot')
@ApiExtraModels(ChatRequestDto, ChatResponseDto)
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

    // 🎯 LOG: User input received
    console.log('\n🚀 CHATBOT REQUEST STARTED');
    console.log('📝 User Query:', chatRequest.query);
    console.log('⏰ Start Time:', new Date().toISOString());

    try {
      // Validate request
      if (!chatRequest.query?.trim()) {
        console.log('❌ Validation failed: Empty query');
        this.logger.warn('Empty query received in chat request');
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

      // 🧠 LOG: Processing with LLM
      console.log('🧠 Processing with OpenAI LLM service...');

      // Process with LLM service
      const llmResponse = await this.llmService.chat(llmRequest);
      const executionTime = Date.now() - startTime;

      // 🔧 LOG: Processing completed
      console.log('🔧 Tool used:', llmResponse.toolUsed || 'none');
      console.log('⏱️  Processing time:', executionTime + 'ms');

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

      // ✅ LOG: Final response ready
      console.log('✅ CHATBOT RESPONSE READY');
      console.log(
        '📤 Response preview:',
        response.response.substring(0, 100) + '...',
      );
      console.log('🏁 End Time:', new Date().toISOString());
      console.log('=====================================\n');

      // Return formatted response
      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // ❌ LOG: Error occurred
      console.log('❌ CHATBOT ERROR');
      console.log('💥 Error:', errorMessage);
      console.log('⏱️  Failed after:', executionTime + 'ms');
      console.log('=====================================\n');

      // Log error with context
      this.logger.error(
        `Chat request failed after ${executionTime}ms: ${errorMessage}`,
        {
          query: chatRequest.query?.substring(0, 100),
          conversationId: chatRequest.conversationId,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
      );

      // Return user-friendly error for HTTP exceptions
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle unexpected errors
      throw new HttpException(
        `Failed to process chat request: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check endpoint for chatbot service
   * Verifies LLM service availability and overall system health
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

      // If it's already an HttpException (from the LLM unavailable case above), re-throw it
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle unexpected errors (like network issues, configuration problems, etc.)
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

  /**
   * Get available tools and their capabilities
   * Returns information about the tools the chatbot can use
   */
  @Get('tools')
  @ApiOperation({
    summary: 'Get available chatbot tools',
    description: `
Retrieve information about available tools and their capabilities.

**Available Tools:**
- **searchProducts**: Search product catalog and return exactly 2 relevant items
- **convertCurrencies**: Convert amounts between currencies with real-time rates

This endpoint is useful for:
- Understanding chatbot capabilities
- API documentation and integration
- Debugging tool availability
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'List of available tools',
    schema: {
      example: {
        tools: [
          {
            name: 'searchProducts',
            description:
              'Search for products based on user criteria. Returns exactly 2 relevant products.',
            parameters: {
              query: 'Search term for product name or description',
              productType: 'Product category or type to filter by',
              minPrice: 'Minimum price filter',
              maxPrice: 'Maximum price filter',
              hasDiscount: 'Filter for products with discounts/sales',
            },
            examples: [
              'I am looking for a phone',
              'I need a present for my dad',
              'Show me some watches',
            ],
          },
          {
            name: 'convertCurrencies',
            description:
              'Convert amount between different currencies using real-time exchange rates',
            parameters: {
              amount: 'Amount to convert (required)',
              fromCurrency:
                'Source currency code (3 letters, e.g., USD) (required)',
              toCurrency:
                'Target currency code (3 letters, e.g., EUR) (required)',
            },
            examples: [
              'How many Canadian Dollars are 350 Euros?',
              'Convert 100 USD to EUR',
              'What is 50 GBP in Japanese Yen?',
            ],
          },
        ],
        totalTools: 2,
        timestamp: '2025-01-27T10:30:00.000Z',
      },
    },
  })
  getAvailableTools() {
    try {
      this.logger.log('Retrieving available tools information');

      const tools = this.llmService.getAvailableTools();

      const toolsInfo = tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: Object.entries(
          tool.function.parameters.properties || {},
        ).reduce(
          (acc, [key, value]) => {
            acc[key] =
              (value as { description?: string }).description ||
              'No description available';
            return acc;
          },
          {} as Record<string, string>,
        ),
        requiredParameters: tool.function.parameters.required || [],
        examples: this.getToolExamples(tool.function.name),
      }));

      return {
        tools: toolsInfo,
        totalTools: tools.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to retrieve tools information: ${errorMessage}`,
      );

      throw new HttpException(
        'Failed to retrieve tools information',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get example queries for each tool
   */
  private getToolExamples(toolName: string): string[] {
    const examples: Record<string, string[]> = {
      searchProducts: [
        'I am looking for a phone',
        'I need a present for my dad',
        'Show me some watches',
        'Find me electronics under $500',
        'What technology products do you have?',
      ],
      convertCurrencies: [
        'How many Canadian Dollars are 350 Euros?',
        'Convert 100 USD to EUR',
        'What is 50 GBP in Japanese Yen?',
        'How much is 1000 JPY in US Dollars?',
        'Convert 250 EUR to British Pounds',
      ],
    };

    return examples[toolName] || [];
  }
}
