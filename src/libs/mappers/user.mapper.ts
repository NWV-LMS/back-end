import { User as PrismaUser } from '@prisma/client';
import { User as UserDto } from '../dto/user/user-response.dto';

// DB entity -> API response DTO mapper.
export const toUserResponse = (user: PrismaUser & { organization?: { name?: string; logo_url?: string | null } | null }): UserDto => ({
  id: user.id,
  organization_id: user.organization_id ?? undefined,
  organization_name: user.organization?.name ?? undefined,
  organization_logo_url: user.organization?.logo_url ?? undefined,
  full_name: user.full_name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

// Smaller user shape for create-student response.
export const toUserInfo = (user: PrismaUser) => ({
  id: user.id,
  full_name: user.full_name,
  phone: user.phone,
  role: user.role,
});
