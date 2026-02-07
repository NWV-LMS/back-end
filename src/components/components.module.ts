import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LeadModule } from './lead/lead.module';
import { StudentModule } from './student/student.module';
import { CourseModule } from './course/course.module';
import { GroupModule } from './group/group.module';
import { HealthModule } from './health/health.module';
import { EnrollmentModule } from './enrollment/enrollment.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    LeadModule,
    StudentModule,
    CourseModule,
    GroupModule,
    HealthModule,
    EnrollmentModule, // Yangi enrollment moduli
  ],
  exports: [AuthModule, UserModule],
})
export class ComponentsModule {}

