import { UserRole } from '@prisma/client';

export class InviteUserResponseDto {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  created_at: Date;
}
