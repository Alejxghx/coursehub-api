import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = randomUUID();
    const started = Date.now();
    res.setHeader('X-Request-Id', requestId);
    res.once('finish', () => {
      // Route template only: no query, body, headers, cookies or raw URL.
      this.logger.log(
        JSON.stringify({
          requestId,
          method: req.method,
          path: req.route?.path ?? '[unmatched]',
          status: res.statusCode,
          durationMs: Date.now() - started,
        }),
      );
    });
    next();
  }
}
