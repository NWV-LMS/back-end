import { UserRole } from '@prisma/client';

//Bu responseda keladigon datalar
export class User {
  id: string;
  organization_id?: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  created_at?: Date;
  updated_at?: Date;
}
