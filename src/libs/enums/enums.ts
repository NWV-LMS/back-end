// Re-export all enums from Prisma (single source of truth)
export {
  UserRole,
  OrganizationStatus,
  StudentStatus,
  LeadStatus,
  AttendanceStatus,
  CourseStatus,
  PaymentMethod,
  PaymentStatus,
  ExpenseCategory,
} from '@prisma/client';

// Custom enums (these are defined in code, not Prisma)
export { TeacherSubject } from './teacher-subjects.enum';
export { TeacherStatus } from './teacher-subjects.enum';
