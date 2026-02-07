import { OrganizationStatus } from 'generated/prisma/enums';

class PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export class PlatformOrganizationDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: OrganizationStatus;
  created_at: Date;
  updated_at: Date;
  usersCount: number;
}

export class PaginatedOrganizationResponseDto {
  items: PlatformOrganizationDto[];
  meta: PaginationMeta;
}
