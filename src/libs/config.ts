export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

export interface ApiInfoResponse {
  name: string;
  version: string;
  description: string;
  environment: string;
}
