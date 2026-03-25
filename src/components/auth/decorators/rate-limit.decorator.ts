import { SetMetadata } from '@nestjs/common';

export type RateLimitOptions = {
  limit: number; // max requests per window
  windowMs: number; // time window in ms
  keyPrefix?: string; // optional override to group endpoints
};

export const RATE_LIMIT_KEY = 'rate_limit';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
