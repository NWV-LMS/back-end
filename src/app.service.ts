import { Injectable } from '@nestjs/common';
import { ApiInfoResponse } from './libs/config';

@Injectable()
export class AppService {
  getApiInfo(): ApiInfoResponse {
    return {
      name: 'CRM-LMS API',
      version: '1.0.0',
      description: 'Education Center CRM + LMS Backend',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
