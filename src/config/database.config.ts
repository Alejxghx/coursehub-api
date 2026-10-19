import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function databaseConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.getOrThrow<string>('DATABASE_HOST'),
    port: config.getOrThrow<number>('DATABASE_PORT'),
    username: config.getOrThrow<string>('DATABASE_USER'),
    password: config.getOrThrow<string>('DATABASE_PASSWORD'),
    database: config.getOrThrow<string>('DATABASE_NAME'),
    autoLoadEntities: true,
    synchronize: config.getOrThrow<string>('NODE_ENV') === 'development',
  };
}
