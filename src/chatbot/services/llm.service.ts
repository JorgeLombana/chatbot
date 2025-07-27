import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  ILLMService,
  LLMChatRequest,
  LLMChatResponse,
  ToolDefinition,
  ToolCall,
  ToolExecutionResult,
  ChatMessage,
  ICurrencyService,
  IProductRepository,
  ConversionRequest,
  ProductSearchCriteria,
} from '../interfaces';

/**
 * OpenAI-powered LLM service with function calling capabilities
 * Implements the 4-step pipeline: receive → analyze → execute tool → respond
 */
@Injectable()
export class LLMService implements ILLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly openai: OpenAI;
  private readonly model = 'gpt-3.5-turbo';
  private readonly maxTokens = 800; // Increased from 500 to allow longer responses
  private readonly temperature = 0.7;

  constructor(
    private readonly configService: ConfigService,
    @Inject('ICurrencyService')
    private readonly currencyService: ICurrencyService,
    @Inject('IProductRepository')
    private readonly productRepository: IProductRepository,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) {
      throw new Error('OpenAI API key is required but not provided');
    }

    this.openai = new OpenAI({ apiKey });
    this.logger.log('OpenAI LLM service initialized successfully');
  }

  /**
   * Main chat method implementing the 4-step LLM pipeline
   */
  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const conversationId =
      request.conversationId || this.generateConversationId();

    try {
      this.logger.log(
        `Processing chat request: "${request.userQuery.substring(0, 100)}..."`,
      );

      // Step 1: Prepare messages for OpenAI
      const messages = this.prepareMessages(request);

      // Step 2: Make first call to OpenAI to analyze query and determine tool usage
      const initialResponse = await this.callOpenAI(messages);

      // Step 3: Handle tool calls if present
      if (initialResponse.tool_calls && initialResponse.tool_calls.length > 0) {
        this.logger.log(
          `OpenAI requested ${initialResponse.tool_calls.length} tool calls`,
        );

        // Execute tools and add results to conversation
        const toolResults = await this.executeAllTools(
          initialResponse.tool_calls,
        );
        messages.push({
          role: 'assistant',
          content: initialResponse.content,
          tool_calls: initialResponse.tool_calls,
        });

        // Add tool results as separate messages
        for (const result of toolResults) {
          messages.push({
            role: 'tool',
            content: result.success
              ? JSON.stringify(result.data)
              : `Error: ${result.error}`,
            tool_call_id: result.toolCallId,
            name: result.toolName,
          });
        }

        // Step 4: Make second call to OpenAI to generate final response
        console.log(
          '🔍 OPENAI DEBUG - Making second call with tool results...',
        );
        console.log('🔍 OPENAI DEBUG - Messages count:', messages.length);
        console.log(
          '🔍 OPENAI DEBUG - Last message (tool result):',
          messages[messages.length - 1],
        );

        const finalChoice = await this.callOpenAI(messages);

        console.log('🔍 OPENAI DEBUG - Final choice received:', {
          content: finalChoice.content,
          contentLength: finalChoice.content?.length || 0,
          role: finalChoice.role,
        });

        // Check if we got a proper response
        const finalResponse = finalChoice.content;
        if (!finalResponse || finalResponse.trim().length === 0) {
          console.log('🔍 OPENAI DEBUG - Empty or null response from OpenAI!');

          // Fallback response based on tool results
          const successfulTools = toolResults.filter((r) => r.success);
          if (successfulTools.length > 0) {
            const toolType = successfulTools[0].toolName;
            console.log(
              '🔍 OPENAI DEBUG - Generating fallback response for tool:',
              toolType,
            );

            if (toolType === 'searchProducts') {
              return {
                response:
                  'I found some products for you, but encountered an issue formatting the response. Please try your request again.',
                conversationId,
                toolUsed: toolType,
                finishReason: 'tool_calls' as const,
              };
            } else if (toolType === 'convertCurrencies') {
              return {
                response:
                  'I was able to convert the currency, but encountered an issue formatting the response. Please try your request again.',
                conversationId,
                toolUsed: toolType,
                finishReason: 'tool_calls' as const,
              };
            }
          }
        }

        console.log('🔍 OPENAI DEBUG - Successfully generated final response');

        return {
          response:
            finalResponse ||
            'I apologize, but I encountered an issue generating a response. Please try again.',
          conversationId,
          toolUsed: toolResults[0]?.toolName,
          toolCalls: initialResponse.tool_calls,
          toolExecutionResults: toolResults,
          finishReason: 'tool_calls' as const,
        };
      }

      // No tools needed - return direct response
      return {
        response:
          initialResponse.content ||
          "I apologize, but I couldn't generate a proper response.",
        conversationId,
        finishReason: 'stop',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Chat processing failed: ${errorMessage}`, {
        userQuery: request.userQuery.substring(0, 100),
        conversationId,
        error: errorMessage,
      });

      return {
        response:
          'I apologize, but I encountered an error while processing your request. Please try again.',
        conversationId,
        finishReason: 'stop',
      };
    }
  }

  /**
   * Get available tool definitions for OpenAI function calling
   */
  getAvailableTools(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'searchProducts',
          description:
            'Search for products based on user criteria. Returns exactly 2 relevant products.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search term for product name or description',
              },
              productType: {
                type: 'string',
                description: 'Product category or type to filter by',
              },
              minPrice: {
                type: 'number',
                description: 'Minimum price filter',
              },
              maxPrice: {
                type: 'number',
                description: 'Maximum price filter',
              },
              hasDiscount: {
                type: 'boolean',
                description: 'Filter for products with discounts/sales',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'convertCurrencies',
          description:
            'Convert amount between different currencies using real-time exchange rates',
          parameters: {
            type: 'object',
            properties: {
              amount: {
                type: 'number',
                description: 'Amount to convert',
              },
              fromCurrency: {
                type: 'string',
                description: 'Source currency code (3 letters, e.g., USD)',
              },
              toCurrency: {
                type: 'string',
                description: 'Target currency code (3 letters, e.g., EUR)',
              },
            },
            required: ['amount', 'fromCurrency', 'toCurrency'],
          },
        },
      },
    ];
  }

  /**
   * Execute a specific tool called by OpenAI
   */
  async executeTool(toolCall: ToolCall): Promise<ToolExecutionResult> {
    const { id: toolCallId, function: func } = toolCall;
    const { name: toolName, arguments: args } = func;

    try {
      this.logger.log(`Executing tool: ${toolName} with args: ${args}`);

      const parsedArgs = JSON.parse(args) as Record<string, unknown>;

      switch (toolName) {
        case 'searchProducts':
          return await this.executeSearchProducts(
            toolCallId,
            toolName,
            parsedArgs,
          );

        case 'convertCurrencies':
          return await this.executeConvertCurrencies(
            toolCallId,
            toolName,
            parsedArgs,
          );

        default:
          this.logger.warn(`Unknown tool requested: ${toolName}`);
          return {
            toolCallId,
            toolName,
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Tool execution failed for ${toolName}:`, errorMessage);

      return {
        toolCallId,
        toolName,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if the LLM service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Test with a simple completion request
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });

      return !!response.choices[0]?.message?.content;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `LLM service availability check failed: ${errorMessage}`,
      );
      return false;
    }
  }

  /**
   * Execute searchProducts tool
   */
  private async executeSearchProducts(
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    try {
      const criteria: ProductSearchCriteria = {
        query: args.query as string,
        productType: args.productType as string,
        minPrice: args.minPrice as number,
        maxPrice: args.maxPrice as number,
        hasDiscount: args.hasDiscount as boolean,
        limit: 2, // Technical requirement: return exactly 2 items
        offset: 0,
      };

      // 🔍 DEBUG: Log search criteria
      console.log('🔍 SEARCH DEBUG - Criteria:', criteria);

      const result = await this.productRepository.searchProducts(criteria);

      // 🔍 DEBUG: Log search results
      console.log('🔍 SEARCH DEBUG - Found products:', result.products.length);
      console.log('🔍 SEARCH DEBUG - Total available:', result.total);
      console.log(
        '🔍 SEARCH DEBUG - Product titles:',
        result.products.map((p) => p.displayTitle),
      );

      const products = result.products.map((product) => ({
        displayTitle: product.displayTitle,
        productType: product.productType,
        price: product.price,
        hasDiscount: product.hasDiscount(),
        hasVariants: product.hasVariants(),
        url: product.url,
        summary: product.getSummary(),
      }));

      this.logger.log(
        `Found ${products.length} products for search: "${args.query as string}"`,
      );

      const toolResult = {
        toolCallId,
        toolName,
        success: true,
        data: {
          products,
          total: result.total,
          searchCriteria: criteria,
        },
      };

      // 🔍 DEBUG: Log tool result
      console.log('🔍 TOOL RESULT DEBUG:', JSON.stringify(toolResult, null, 2));

      return toolResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Product search failed';

      // 🔍 DEBUG: Log tool error
      console.log('🔍 TOOL ERROR DEBUG:', errorMessage);

      return {
        toolCallId,
        toolName,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute convertCurrencies tool
   */
  private async executeConvertCurrencies(
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    try {
      const request: ConversionRequest = {
        amount: args.amount as number,
        fromCurrency: args.fromCurrency as string,
        toCurrency: args.toCurrency as string,
      };

      const result = await this.currencyService.convertCurrency(request);

      this.logger.log(
        `Converted ${result.amount} ${result.fromCurrency} to ${result.convertedAmount} ${result.toCurrency}`,
      );

      return {
        toolCallId,
        toolName,
        success: true,
        data: {
          amount: result.amount,
          fromCurrency: result.fromCurrency,
          toCurrency: result.toCurrency,
          convertedAmount: result.convertedAmount,
          exchangeRate: result.exchangeRate,
          formattedConversion: result.getFormattedConversion(),
          exchangeRateDescription: result.getExchangeRateDescription(),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Currency conversion failed';
      return {
        toolCallId,
        toolName,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute all tool calls in parallel
   */
  private async executeAllTools(
    toolCalls: ToolCall[],
  ): Promise<ToolExecutionResult[]> {
    const toolPromises = toolCalls.map((toolCall) =>
      this.executeTool(toolCall),
    );
    return await Promise.all(toolPromises);
  }

  /**
   * Make API call to OpenAI
   */
  private async callOpenAI(messages: ChatMessage[]) {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages:
        messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: this.getAvailableTools(),
      tool_choice: 'auto',
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response choice returned from OpenAI');
    }

    return choice.message;
  }

  /**
   * Prepare messages for OpenAI API call
   */
  private prepareMessages(request: LLMChatRequest): ChatMessage[] {
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `You are a helpful e-commerce shopping assistant with access to product search and currency conversion tools.

CORE CAPABILITIES:
1. searchProducts: Search product catalog (returns exactly 2 most relevant products)
2. convertCurrencies: Convert amounts between currencies using real-time rates

CRITICAL RULES - FOLLOW EXACTLY:
1. ALWAYS use tools proactively - never ask for clarification first
2. For gift requests, search immediately using the most relevant category or broad search terms
3. For product searches - use "query" parameter with the product name
4. For currency questions - provide helpful conversions with real rates

GIFT SEARCH STRATEGY - VERY IMPORTANT:
For gift requests like "present for dad", "gift for mom", use these specific approaches:

PRESENTS FOR DAD:
- Use productType: "Technology" (phones, laptops, gaming, headphones)
- OR query: "knife" (kitchen tools, chef knives)
- OR query: "gaming" (PlayStation, Nintendo, gaming laptops)
- OR query: "watch" (Apple Watch, smartwatches)
- Available categories: Technology, Home (tools/cookware)

PRESENTS FOR MOM:
- Use productType: "Clothing" (fashion, accessories, bags)
- OR query: "beauty" (makeup, skincare)
- OR query: "home" (home decor, kitchen items)

GENERAL SEARCH RULES:
- query: "phone" (for "looking for phone")
- query: "watch" (for "watch prices") 
- productType: "Technology" (for tech gifts, gaming, electronics)
- productType: "Home" (for tools, cookware, furniture)
- productType: "Clothing" (for fashion, accessories)

RESPONSE FORMATTING RULES:
- Always provide clear, helpful responses
- Include product names, prices, and key details
- Mention if products are on sale
- Format prices clearly with currency
- Include product links when available
- Be enthusiastic and helpful about gift suggestions

EXAMPLES OF GOOD RESPONSES:
"I found 2 great gift options for your dad:

1. **iPhone 12** - Technology
   - Price: $900.00 USD (On Sale!)
   - Perfect for staying connected and tech-savvy dads
   
2. **Apple Watch SE** - Technology  
   - Price: $180.00 USD
   - Great for fitness tracking and notifications

Both are excellent choices that most dads would love!"

Remember: Always be positive, helpful, and provide complete information from the search results. For gifts, focus on popular, practical items that make great presents.`,
    };

    const userMessage: ChatMessage = {
      role: 'user',
      content: request.userQuery,
    };

    // Start with system message and user query
    const messages: ChatMessage[] = [systemMessage];

    // Add any previous conversation messages if provided
    if (request.messages && request.messages.length > 0) {
      messages.push(...request.messages);
    }

    // Add the current user message
    messages.push(userMessage);

    return messages;
  }

  /**
   * Generate unique conversation ID
   */
  private generateConversationId(): string {
    return `chat-${Date.now()}-${uuidv4().substring(0, 8)}`;
  }
}
