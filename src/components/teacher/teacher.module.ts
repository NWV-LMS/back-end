import { Module } from '@nestjs/common';
import { TeacherController } from './teacher.controller';
import { TeacherQueryService } from './teacher-query.service';
import { TeacherMutationService } from './teacher-mutation.service';
import { TeacherBulkService } from './teacher-bulk.service';
import { TeacherSalaryService } from './teacher-salary.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TeacherController],
  providers: [
    TeacherQueryService,
    TeacherMutationService,
    TeacherBulkService,
    TeacherSalaryService,
  ],
  exports: [
    TeacherQueryService,
    TeacherMutationService,
    TeacherBulkService,
    TeacherSalaryService,
  ],
})
export class TeacherModule {}
