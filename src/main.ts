import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './libs/interceptor/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  });

  console.log('Starting server...');
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
