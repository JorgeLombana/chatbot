import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ChatMessage } from '../interfaces';

/**
 * Request DTO for chatbot interactions
 * Represents the user's query to the chatbot with optional conversation context
 */
export class ChatRequestDto {
  @ApiProperty({
    description: 'User query or message to the chatbot',
    example: 'I am looking for a phone',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString({ message: 'Query must be a string' })
  @IsNotEmpty({ message: 'Query cannot be empty' })
  @MinLength(1, { message: 'Query cannot be empty' })
  @MaxLength(1000, { message: 'Query is too long (max 1000 characters)' })
  query!: string;

  @ApiPropertyOptional({
    description:
      'Optional conversation ID to continue an existing conversation',
    example: 'chat-1642584723456-abc123',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Previous messages in the conversation for context',
    example: [],
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  messages?: ChatMessage[];
}
