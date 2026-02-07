import { Student } from 'generated/prisma/client';
import { StudentResponseDto } from '../dto/student/student-response.dto';

// DB entity -> API response DTO mapper.
export const toStudentResponse = (student: Student): StudentResponseDto => ({
  id: student.id,
  name: student.name,
  phone: student.phone,
  address: student.address,
  parent: student.parent ?? undefined,
  status: student.status,
  organization_id: student.organization_id,
});
