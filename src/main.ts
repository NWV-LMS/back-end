import './instrument';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './libs/interceptor/logging.interceptor';
import { validateEnvOrThrow } from './libs/env.validation';
import { PrismaExceptionFilter } from './database/prisma-exception.filter';

async function bootstrap() {
  // Fail fast on misconfiguration (especially in production).
  validateEnvOrThrow();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Suppress default NestJS console logger — pino takes over below.
    bufferLogs: true,
  });

  // Route all NestJS internal logs through pino.
  app.useLogger(app.get(Logger));

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.setGlobalPrefix('api');

  // Required for correct IP detection behind Vercel's proxy layer.
  app.set('trust proxy', 1);

  const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

  // Security — must come before compression.
  app.use(
    helmet({
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  // Compression — after helmet, before routes.
  app.use(compression());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: isProd
      ? allowedOrigins.length > 0
        ? allowedOrigins
        : false
      : true,
    credentials: true,
  });

  // Swagger API Documentation (dev only).
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('CRM-LMS API')
      .setDescription('Education Center CRM + LMS Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('payment', 'Payment management')
      .addTag('expense', 'Expense management')
      .addTag('finance', 'Finance dashboard & reports')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  const logger = new Logger('Bootstrap');
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: ${await app.getUrl()}`);
  if (!isProd) {
    logger.log(`Swagger docs: ${await app.getUrl()}/api-docs`);
  }
}
bootstrap();
