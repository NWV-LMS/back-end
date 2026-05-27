import '../src/instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { PrismaExceptionFilter } from '../src/database/prisma-exception.filter';
import { LoggingInterceptor } from '../src/libs/interceptor/logging.interceptor';

let cachedServer: any;

async function bootstrap() {
  if (!cachedServer) {
    const app = await NestFactory.create(AppModule);

    // Apply same middleware/pipes as in main.ts
    app.setGlobalPrefix('api');
    // Required for correct IP detection behind Vercel's proxy layer.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.use(helmet());
    app.enableCors({
      origin: true,
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
