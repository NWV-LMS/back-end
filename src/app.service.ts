import { Injectable } from '@nestjs/common';
import { ApiInfoResponse, HealthCheckResponse } from './libs/config';
import { DatabaseService } from './database/database.service';

@Injectable()
export class AppService {
  constructor(private readonly database: DatabaseService) {}

  async healthCheck(): Promise<HealthCheckResponse> {
    let dbStatus: 'up' | 'down' = 'down';
    try {
      await this.database.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    return {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      db: dbStatus,
    };
  }

  getApiInfo(): ApiInfoResponse {
    return {
      name: 'CRM-LMS API',
      version: '1.0.0',
      description: 'Education Center CRM + LMS Backend',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
