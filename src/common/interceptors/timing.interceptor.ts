import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Response } from 'express';
import { tap } from 'rxjs';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const started = performance.now();
    const response = context.switchToHttp().getResponse<Response>();
    const record = () => {
      if (!response.headersSent)
        response.setHeader(
          'X-Response-Time',
          `${(performance.now() - started).toFixed(2)}ms`,
        );
    };
    // Observe both paths without catching, replacing or hiding exceptions.
    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
