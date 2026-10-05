import { QueryFailedError } from 'typeorm';

export function postgresErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return (error.driverError as Error & { code?: string }).code;
}
