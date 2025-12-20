import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { AppModule } from './app.module';
import { DatabaseService } from './database/database.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  console.log('Starting server...');
  app.enableShutdownHooks()
  await app
    .listen(process.env.PORT || 3000)
    .then(() => {
      console.log(`Server is running on port ${process.env.PORT || 3000}`);
    })
    .catch((error) => {
      console.error('Error starting server:', error);
    });
}
bootstrap();
