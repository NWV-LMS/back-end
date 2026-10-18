import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountService } from './account.service';
import { safeEqual } from './account.security';

@Injectable()
export class AccountBffGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    if (this.config.get('ACCOUNT_AUTH_ENABLED') !== 'true')
      throw new NotFoundException();
    const secret = this.config.get<string>('AUTH_BFF_SECRET');
    const supplied = context.switchToHttp().getRequest().headers[
      'x-auth-bff-secret'
    ];
    if (
      !secret ||
      secret.length < 32 ||
      typeof supplied !== 'string' ||
      !safeEqual(secret, supplied)
    )
      throw new UnauthorizedException('Trusted server required');
    return true;
  }
}
@Injectable()
export class AccountSessionGuard implements CanActivate {
  constructor(private readonly accounts: AccountService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer '))
      throw new UnauthorizedException();
    req.accountContext = await this.accounts.authenticate(header.slice(7));
    return true;
  }
}
