import {
  Catch,
  HttpException,
  type ExceptionFilter,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CourseNotFoundError,
  CoursePermissionError,
} from '../../courses/domain/course.errors.js';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    if (response.headersSent) return;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : exception instanceof CourseNotFoundError
          ? 404
          : exception instanceof CoursePermissionError
            ? 403
            : 500;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const detail =
      typeof body === 'object' && body !== null
        ? (body as { message?: unknown; error?: string })
        : undefined;
    const message =
      status >= 500
        ? 'Internal server error'
        : (detail?.message ??
          (typeof body === 'string'
            ? body
            : exception instanceof CourseNotFoundError ||
                exception instanceof CoursePermissionError
              ? exception.message
              : 'Request failed'));
    response.status(status).json({
      statusCode: status,
      message,
      ...(status < 500 && detail?.error ? { error: detail.error } : {}),
      // Deliberately exclude the raw URL/query, which may contain credentials.
      path: request.path,
      timestamp: new Date().toISOString(),
      requestId: response.getHeader('X-Request-Id') ?? null,
    });
  }
}
