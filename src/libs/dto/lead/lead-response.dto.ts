import { LeadStatus } from '@prisma/client';

export class LeadResponseDto {
  id: string;
  organization_id: string;
  admin: string;
  full_name: string;
  phone: string;
  source: string;
  status: LeadStatus;
}
