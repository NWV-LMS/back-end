import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../../libs/types/auth';
import { OrganizationActiveGuard } from '../guards/organization-active.guard';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly organizationActiveGuard: OrganizationActiveGuard,
  ) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      // Startup validation should catch this first, but keep a hard guard here too.
      throw new Error('JWT_ACCESS_SECRET is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = { ...payload, id: payload.sub };
    // Passport has verified the JWT before invoking this callback. Check the
    // current organization status here, before any protected controller runs.
    await this.organizationActiveGuard.validateOrganization(user);
    return user;
  }
}
