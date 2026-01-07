import { StudentStatus, UserRole } from 'generated/prisma/enums';

class UserInfo {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
}

class StudentInfo {
  id: string;
  organization_id: string;
  name: string;
  phone: string;
  address: string;
  parent?: string;
  status: StudentStatus;
}

export class CreateStudentResponseDto {
  message: string;
  student: StudentInfo;
  user: UserInfo;
  temporaryPassword?: string;
}
