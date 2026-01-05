import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LeadModule } from './lead/lead.module';
import { Student,course,groupModule } from './student,course,group/student,course,group.module';
import { StudentModule } from './student/student.module';
import { CourseModule } from './course/course.module';
import { GrouModule } from './grou/grou.module';
import { GroupModule } from './group/group.module';

@Module({
  imports: [AuthModule, UserModule, LeadModule, Student,course,groupModule, StudentModule, CourseModule, GrouModule, GroupModule],
  exports: [AuthModule, UserModule]
})
export class ComponentsModule {}
