import { Enrollment } from '@prisma/client/default';
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
  monthly_fee: enrollment.monthly_fee.toString(),
  discount_amount: enrollment.discount_amount.toString(),
  student: enrollment.student,
  group: enrollment.group,
});
