import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { LeadModule } from './lead/lead.module';
import { StudentModule } from './student/student.module';
import { CourseModule } from './course/course.module';
import { GroupModule } from './group/group.module';
import { HealthModule } from './health/health.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { OrganizationModule } from './organization/organization.module';
import { LessonModule } from './lesson/lesson.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    LeadModule,
    StudentModule,
    CourseModule,
    GroupModule,
    HealthModule,
    EnrollmentModule,
    OrganizationModule,
    LessonModule,
    AttendanceModule,
    ProgressModule,
  ],
  exports: [AuthModule, UserModule],
})
export class ComponentsModule {}
