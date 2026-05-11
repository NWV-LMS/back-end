import { StudentStatus } from '@prisma/client';

export class StudentResponseDto {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  parent?: string;
  status: StudentStatus;
  organization_id: string;
}
