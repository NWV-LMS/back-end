import {
  CanActivate,
  ExecutionContext,
  Injectable,
  TooManyRequestsException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private sweepCounter = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Only enforce rate limit where explicitly enabled.
    if (!opts) return true;

    const req = context.switchToHttp().getRequest();
    const ip = this.getClientIp(req);
    const keyPrefix =
      opts.keyPrefix ??
      `${req.method ?? 'METHOD'}:${req.route?.path ?? req.url ?? 'PATH'}`;

    const key = `${ip}:${keyPrefix}`;

    const now = Date.now();

    // Prevent unbounded memory growth in long-running processes.
    // Cheap periodic sweep; good enough for a single-instance monolith.
    this.sweepCounter += 1;
    if (this.sweepCounter % 1000 === 0) {
      for (const [k, b] of this.buckets.entries()) {
        if (now >= b.resetAt) this.buckets.delete(k);
      }
    }

    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > opts.limit) {
      throw new TooManyRequestsException('Too many requests, try again later');
    }

    return true;
  }

  private getClientIp(req: any): string {
    const xff = req.headers?.['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0].trim();
    }
    if (typeof req.ip === 'string' && req.ip.length > 0) return req.ip;
    if (typeof req.connection?.remoteAddress === 'string')
      return req.connection.remoteAddress;
    return 'unknown';
  }
}
