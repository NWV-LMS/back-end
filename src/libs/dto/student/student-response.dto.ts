import { StudentStatus } from '@prisma/client';

export class StudentResponseDto {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  parent?: string;
  parent_phone?: string;
  status: StudentStatus;
  deleted_at: Date | null;
  organization_id: string;
}
