import { StudentStatus } from '@prisma/client';

class StudentInfo {
  id: string;
  organization_id: string;
  name: string;
  phone: string;
  address: string | null;
  parent?: string;
  status: StudentStatus;
}

export class CreateStudentResponseDto {
  message: string;
  student: StudentInfo;
}
