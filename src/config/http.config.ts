import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function configureHttp(app: INestApplication) {
  const origins = app
    .get(ConfigService)
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id', 'X-Response-Time'],
  });
}
