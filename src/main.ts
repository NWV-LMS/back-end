import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './libs/interceptor/logging.interceptor';
import { validateEnvOrThrow } from './libs/env.validation';
import { PrismaExceptionFilter } from './database/prisma-exception.filter';

async function bootstrap() {
  // Fail fast on misconfiguration (especially in production).
  validateEnvOrThrow();

  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  const isProd = (process.env.NODE_ENV ?? 'development') === 'production';
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  app.enableCors({
    origin: isProd ? allowedOrigins : true,
    credentials: true,
  });

  console.log('Starting server...');
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
