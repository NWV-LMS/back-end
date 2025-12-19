import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ComponentsModule } from './components/components.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [ComponentsModule, DatabaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
