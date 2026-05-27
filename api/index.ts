import '../src/instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { PrismaExceptionFilter } from '../src/database/prisma-exception.filter';
import { LoggingInterceptor } from '../src/libs/interceptor/logging.interceptor';

let cachedServer: any;

async function bootstrap() {
  if (!cachedServer) {
    const app = await NestFactory.create(AppModule, {
      // Suppress default NestJS console logger — pino takes over below.
      bufferLogs: true,
    });

    // Route all NestJS internal logs through pino.
    app.useLogger(app.get(Logger));

    // Apply same middleware/pipes as in main.ts
    app.setGlobalPrefix('api');
    // Required for correct IP detection behind Vercel's proxy layer.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.use(helmet());
    // Compression — after helmet, before routes.
    app.use(compression());
    const isProd = (process.env.NODE_ENV ?? 'development') === 'production';
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

    app.useGlobalFilters(new PrismaExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new LoggingInterceptor());

    await app.init();
    cachedServer = app.getHttpAdapter().getInstance();
  }
  return cachedServer;
}

export default async (req: any, res: any) => {
  const server = await bootstrap();
  return server(req, res);
};
