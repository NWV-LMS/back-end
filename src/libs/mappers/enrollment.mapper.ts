import { Enrollment } from 'generated/prisma/client';
import { EnrollmentResponseDto } from '../dto/enrollment/enrollment-response.dto';

type EnrollmentWithRelations = Enrollment & {
  student?: {
    id: string;
    name: string;
    phone: string;
    status: string;
  };
  group?: {
    id: string;
    name: string;
    course?: { id: string; title: string };
    teacher?: { id: string; full_name: string };
  };
};

// DB entity -> API response DTO mapper.
export const toEnrollmentResponse = (
  enrollment: EnrollmentWithRelations,
): EnrollmentResponseDto => ({
  id: enrollment.id,
  student_id: enrollment.student_id,
  group_id: enrollment.group_id,
  enrolled_at: enrollment.enrolled_at,
  student: enrollment.student,
  group: enrollment.group,
});
