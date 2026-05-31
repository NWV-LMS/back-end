import { UserRole } from '@prisma/client';

//Bu responseda keladigon datalar
export class User {
  id: string;
  organization_id?: string;
  organization_name?: string;
  organization_logo_url?: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  created_at?: Date;
  updated_at?: Date;
}
