import { Injectable } from '@nestjs/common';
import { ApiInfoResponse, HealthCheckResponse } from './libs/config';

@Injectable()
export class AppService {
  healthCheck(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
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
