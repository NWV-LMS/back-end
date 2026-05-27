import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ComponentsModule } from './components/components.module';
import { DatabaseModule } from './database/database.module';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { RateLimitGuard } from './components/auth/guards/rate-limit.guard';
import { OrganizationActiveGuard } from './components/auth/guards/organization-active.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV}.local`, // .env.production.local when NODE_ENV=production
        '.env.local', // fallback to .env.local
        `.env.${process.env.NODE_ENV}`, // .env.production
        '.env', // default .env
      ],
    }),
    // Structured logger: JSON in production (Vercel, Docker, k8s),
    // pretty-printed in development. Redacts sensitive fields.
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.refreshToken',
        ],
      },
    }),
    // Global rate limit: 60 requests per minute per IP.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
    SentryModule.forRoot(),
    ComponentsModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Sentry: capture unhandled exceptions before any other filter runs.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    // Throttler global guard (60 req/min default; tighter limits via @Throttle).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Legacy per-endpoint rate limit decorator guard — kept for any remaining usages.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    // Block access for users belonging to inactive organizations.
    { provide: APP_GUARD, useClass: OrganizationActiveGuard },
  ],
})
export class AppModule {}
