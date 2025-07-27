import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for chatbot interactions
 * Contains the final LLM-generated response after tool execution
 */
export class ChatResponseDto {
  @ApiProperty({
    description:
      'Final response from the chatbot after processing the query and executing tools',
    example:
      'I found some great phone options for you! Here are 2 relevant products: iPhone 12 (Technology) priced at $900.0 USD (On Sale) and iPhone 13 (Technology) priced at $1099.0 USD (On Sale). Both offer excellent features and performance.',
  })
  response: string;

  @ApiProperty({
    description: 'Unique identifier for tracking this conversation',
    example: 'chat-1642584723456-abc123',
    required: false,
  })
  conversationId?: string;

  @ApiProperty({
    description: 'Tool that was used to process the query',
    example: 'searchProducts',
    enum: ['searchProducts', 'convertCurrencies', 'none'],
    required: false,
  })
  toolUsed?: string;

  @ApiProperty({
    description: 'OpenAI finish reason for function calling responses',
    example: 'tool_calls',
    enum: ['stop', 'tool_calls', 'length', 'content_filter'],
    required: false,
  })
  finishReason?: string;

  @ApiProperty({
    description: 'Token usage information from OpenAI',
    example: {
      promptTokens: 150,
      completionTokens: 75,
      totalTokens: 225,
    },
    required: false,
  })
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  @ApiProperty({
    description: 'ISO timestamp of when the response was generated',
    example: '2025-01-26T22:15:30.123Z',
  })
  timestamp: string;
}
