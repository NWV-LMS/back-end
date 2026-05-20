import { Module } from '@nestjs/common';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { TeacherSalaryService } from './teacher-salary.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TeacherController],
  providers: [TeacherService, TeacherSalaryService],
  exports: [TeacherService, TeacherSalaryService],
})
export class TeacherModule {}