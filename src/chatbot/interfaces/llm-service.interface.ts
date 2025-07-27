/**
 * OpenAI function call structure
 */
export interface FunctionCall {
  name: string;
  arguments: string; // JSON string as per OpenAI docs
}

/**
 * OpenAI tool call structure
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}

/**
 * Tool execution result from the LLM
 */
export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * OpenAI message structure for function calling
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

/**
 * Request parameters for LLM chat completion
 */
export interface LLMChatRequest {
  userQuery: string;
  conversationId?: string;
  context?: Record<string, unknown>;
  messages?: ChatMessage[];
}

/**
 * Response from LLM service matching OpenAI's structure
 */
export interface LLMChatResponse {
  response: string;
  toolUsed?: string;
  conversationId?: string;
  toolCalls?: ToolCall[];
  toolExecutionResults?: ToolExecutionResult[];
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Available function/tool definition for OpenAI
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
        items?: {
          type: string;
        };
      }
    >;
    required?: string[];
  };
}

/**
 * Tool definition for OpenAI function calling
 */
export interface ToolDefinition {
  type: 'function';
  function: FunctionDefinition;
}

/**
 * Interface for Large Language Model service
 * Defines the contract for LLM interactions and tool execution following OpenAI function calling
 */
export interface ILLMService {
  /**
   * Process user query and generate response with optional tool execution
   * @param request - Chat request parameters
   * @returns Promise resolving to LLM response
   */
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;

  /**
   * Get available tool definitions for function calling
   * @returns Array of tool definitions compatible with OpenAI
   */
  getAvailableTools(): ToolDefinition[];

  /**
   * Execute a specific tool/function called by OpenAI
   * @param toolCall - The tool call from OpenAI response
   * @returns Promise resolving to tool execution result
   */
  executeTool(toolCall: ToolCall): Promise<ToolExecutionResult>;

  /**
   * Check if the service is available and properly configured
   * @returns Promise resolving to boolean indicating availability
   */
  isAvailable(): Promise<boolean>;
}
