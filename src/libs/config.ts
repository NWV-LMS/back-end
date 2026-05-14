export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  db: 'up' | 'down';
}

export interface ApiInfoResponse {
  name: string;
  version: string;
  description: string;
  environment: string;
}
