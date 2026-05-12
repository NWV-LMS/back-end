import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { StudentInviteService } from './student-invite.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [StudentController],
  providers: [StudentService, StudentInviteService],
  exports: [StudentService, StudentInviteService],
})
export class StudentModule {}
