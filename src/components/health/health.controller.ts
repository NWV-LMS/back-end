import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { DatabaseService } from '../../database/database.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly db: DatabaseService,
  ) {}

  /** Lightweight liveness probe — no I/O, always fast. */
  @Get()
  ping() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /** Readiness probe — verifies database connectivity. Returns 503 on failure. */
  @Get('db')
  @HealthCheck()
  checkDb() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.db),
    ]);
  }
}
