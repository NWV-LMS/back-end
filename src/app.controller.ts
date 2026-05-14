import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getApiInfo() {
    return this.appService.getApiInfo();
  }

  @Get('health')
  healthCheck(): Promise<import('./libs/config').HealthCheckResponse> {
    return this.appService.healthCheck();
  }
}
