import { LeadStatus } from 'generated/prisma/enums'

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
