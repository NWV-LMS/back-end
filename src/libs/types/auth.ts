import { UserRole } from 'generated/prisma/enums';

export interface JwtPayload {
  sub: string;
  email: string;
  phone: string;
  name:string
  role: UserRole;
  organization_id: string | null;
}

export interface JwtTokens {
  accessToken: string;
  refreshToken: string;
}
