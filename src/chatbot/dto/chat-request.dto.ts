import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

/**
 * Request DTO for chatbot interactions
 * Represents the user's query to the chatbot
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
}
