import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';

const server = express();

export const bootstrap = async (expressInstance: express.Express) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  // Replicating configuration from src/main.ts
  app.use(helmet());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // We do NOT call app.listen() here. 
  // We just initialize the app so it's ready to handle requests.
  await app.init();
  return app;
};

export default async (req: any, res: any) => {
  await bootstrap(server);
  server(req, res);
};
