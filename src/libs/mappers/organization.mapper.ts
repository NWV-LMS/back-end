import { Organization } from 'generated/prisma/client';
import { PlatformOrganizationDto } from '../dto/organization/platform-organization.dto';

type OrganizationWithCount = Organization & {
  _count?: { users?: number };
};

// DB entity -> API response DTO mapper.
export const toPlatformOrganization = (
  organization: OrganizationWithCount,
): PlatformOrganizationDto => ({
  id: organization.id,
  name: organization.name,
  email: organization.email,
  phone: organization.phone,
  status: organization.status,
  created_at: organization.created_at,
  updated_at: organization.updated_at,
  usersCount: organization._count?.users ?? 0,
});
