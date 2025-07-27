import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | object;
  correlationId?: string;
}

interface ExceptionResponseObject {
  message?: string;
  error?: string;
  statusCode?: number;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Global HTTP exception filter that provides structured error responses
 * and correlation tracking for monitoring
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * Handles HTTP exceptions and provides structured error responses
   * @param exception - The HTTP exception that was thrown
   * @param host - ArgumentsHost containing request/response context
   */
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const exceptionResponse = exception.getResponse();

    // Type-safe error message extraction
    let errorMessage: string;
    if (typeof exceptionResponse === 'string') {
      errorMessage = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as ExceptionResponseObject;
      errorMessage =
        responseObj.message || responseObj.error || 'Unknown error';
    } else {
      errorMessage = 'Unknown error';
    }

    this.logger.error(`HTTP ${status} Error: ${errorMessage}`, {
      correlationId,
      path: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      stack: status >= 500 ? exception.stack : undefined,
    });

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        process.env.NODE_ENV === 'production' && status >= 500
          ? 'Internal server error'
          : errorMessage,
      correlationId,
    };

    // Remove stack traces in production for object responses
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const sanitizedResponse = {
        ...exceptionResponse,
      } as ExceptionResponseObject;
      if (process.env.NODE_ENV === 'production' && sanitizedResponse.stack) {
        delete sanitizedResponse.stack;
      }
      errorResponse.message = sanitizedResponse;
    }

    response.status(status).json(errorResponse);
  }
}

/**
 * Global catch-all exception filter for unhandled exceptions
 * Ensures all errors are logged and properly formatted
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /**
   * Handles all unhandled exceptions
   * @param exception - Any unhandled exception
   * @param host - ArgumentsHost containing request/response context
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logger.error(
      `Unhandled Exception: ${
        exception instanceof Error ? exception.message : 'Unknown error'
      }`,
      {
        correlationId,
        path: request.url,
        method: request.method,
        stack: exception instanceof Error ? exception.stack : undefined,
        exception:
          exception instanceof Error ? exception.name : typeof exception,
      },
    );

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception instanceof Error
            ? exception.message
            : 'Unknown error',
      correlationId,
    };

    response.status(status).json(errorResponse);
  }
}
