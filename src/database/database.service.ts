import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Build the Prisma DATABASE_URL with an env-driven connection pool limit.
 *
 * - On Vercel serverless each instance should use 1 connection (default).
 * - On a traditional server (Docker/VPS/k8s) set DATABASE_CONNECTION_LIMIT=10
 *   (or higher) in your environment.
 * - If the URL already contains `connection_limit=` it is left unchanged.
 */
function buildDatasourceUrl(): string {
  const raw = process.env.DATABASE_URL ?? '';
  if (!raw) return raw;

  // Respect an explicitly configured connection_limit in the URL.
  if (raw.includes('connection_limit=')) return raw;

  const limit = process.env.DATABASE_CONNECTION_LIMIT ?? '1';
  const separator = raw.includes('?') ? '&' : '?';
  return `${raw}${separator}connection_limit=${limit}`;
}

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    super({
      datasources: {
        db: { url: buildDatasourceUrl() },
      },
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
  }
}
