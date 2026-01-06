import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LeadModule } from './lead/lead.module';
import { StudentModule } from './student/student.module';
import { CourseModule } from './course/course.module';
import { GroupModule } from './group/group.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    LeadModule,
    StudentModule,
    CourseModule,
    GroupModule,
  ],
  exports: [AuthModule, UserModule],
})
export class ComponentsModule {}
