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
      'I found some great phone options for you! Here are 2 relevant products: iPhone 15 Pro priced at $999 and Samsung Galaxy S24 priced at $899. Both offer excellent features and performance.',
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
    description: 'ISO timestamp of when the response was generated',
    example: '2025-01-26T22:15:30.123Z',
  })
  timestamp: string;
}
