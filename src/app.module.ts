import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ComponentsModule } from './components/components.module';
import { DatabaseModule } from './database/database.module';
import { APP_GUARD } from '@nestjs/core';
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
    ComponentsModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate limit only endpoints decorated with @RateLimit.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    // Block access for users belonging to inactive organizations.
    { provide: APP_GUARD, useClass: OrganizationActiveGuard },
  ],
})
export class AppModule {}
