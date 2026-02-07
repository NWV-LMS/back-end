import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from '../../../libs/types/auth';

@Injectable()
export class OrganizationIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!user.organization_id) {
      throw new UnauthorizedException(
        'Organization ID is required but not found in token',
      );
    }

    request.organizationId = user.organization_id;

    return true;
  }
}
