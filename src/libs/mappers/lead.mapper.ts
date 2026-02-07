import { Lead } from 'generated/prisma/client';
import { LeadResponseDto } from '../dto/lead/lead-response.dto';

// DB entity -> API response DTO mapper.
export const toLeadResponse = (lead: Lead): LeadResponseDto => ({
  id: lead.id,
  organization_id: lead.organization_id,
  admin: lead.admin,
  full_name: lead.full_name,
  phone: lead.phone,
  source: lead.source,
  status: lead.status,
});
