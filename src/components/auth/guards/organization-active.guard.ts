import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OrganizationStatus, UserRole } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { JwtPayload } from '../../../libs/types/auth';

@Injectable()
export class OrganizationActiveGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as JwtPayload | undefined;

    // Not an authenticated request (or not using JwtAuthGuard) -> allow.
    if (!user) return true;

    // Platform owner bypasses organization status checks.
    if (user.role === UserRole.SUPER_ADMIN) return true;

    if (!user.organization_id) {
      throw new UnauthorizedException('Organization ID is missing in token');
    }

    const org = await this.database.organization.findUnique({
      where: { id: user.organization_id },
      select: { status: true },
    });

    if (!org) {
      throw new UnauthorizedException('Organization not found');
    }

    if (org.status !== OrganizationStatus.ACTIVE) {
      throw new ForbiddenException('Organization is inactive');
    }

    return true;
  }
}
