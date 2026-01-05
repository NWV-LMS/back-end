import { LeadStatus } from 'generated/prisma/enums';

export class LeadResponseDto {
  id: string;
  organization_id: string;
  admin: string;
  full_name: string;
  phone: string;
  source: string;
  status: LeadStatus;
}
