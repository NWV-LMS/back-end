import { LeadStatus } from '@prisma/client';

export class CreateLeadDto {
  full_name: string;
  phone: string;
  email?: string;
  source?: string; // instagram, ads, referral
}

export class UpdateLeadDto {
  full_name?: string;
  phone?: string;
  email?: string;
  status?: LeadStatus;
}

export class ConvertLeadDto {
  initial_payment?: number;
  group_id?: string;
}
