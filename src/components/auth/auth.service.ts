import { digest } from './accounts/account.security';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';

import { toUserResponse } from '../../libs/mappers/user.mapper';
import { DatabaseService } from '../../database/database.service';
import { RefreshTokenDto } from '../../libs/dto/auth/refresh-token.dto';
import { JwtPayload, JwtTokens } from '../../libs/types/auth';
import { OrganizationStatus, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokens(payload: JwtPayload): Promise<JwtTokens> {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const accessExpires = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    const refreshExpires = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    // Startup env validation should ensure these exist; keep runtime guard too.
    if (!accessSecret) throw new Error('JWT_ACCESS_SECRET is not set');
    if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET is not set');
    if (!accessExpires) throw new Error('JWT_ACCESS_EXPIRES_IN is not set');
    if (!refreshExpires) throw new Error('JWT_REFRESH_EXPIRES_IN is not set');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, token_use: 'access' },
        {
          secret: accessSecret,
          expiresIn: accessExpires,
          algorithm: 'HS256',
          jwtid: randomUUID(),
        },
      ),
      this.jwtService.signAsync(
        { ...payload, token_use: 'refresh' },
        {
          secret: refreshSecret,
          expiresIn: refreshExpires,
          algorithm: 'HS256',
          jwtid: randomUUID(),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.database.user.update({
      where: { id: userId },
      data: { refresh_token: this.refreshTokenDigest(refreshToken) },
    });
  }

  private refreshTokenDigest(refreshToken: string): string {
    // JWTs exceed bcrypt's 72-byte input limit. Hash every byte of the signed,
    // high-entropy token instead; existing bcrypt sessions require a new login.
    return `sha256:${createHash('sha256').update(refreshToken).digest('hex')}`;
  }

  async validateTenant(payload: JwtPayload) {
    const session = await this.database.tenantSession.findUnique({
      where: { id: payload.session_id },
      include: {
        user: { include: { organization: true } },
        accountSession: { include: { account: true } },
      },
    });
    const parent = session?.accountSession;
    if (
      !session ||
      !parent ||
      session.revoked_at ||
      session.expires_at <= new Date() ||
      parent.revoked_at ||
      parent.expires_at <= new Date() ||
      parent.account.disabled_at ||
      !parent.account.email_verified_at ||
      parent.auth_version !== parent.account.auth_version ||
      session.user_id !== payload.sub ||
      session.user.account_id !== parent.account_id ||
      session.user.organization_id !== payload.organization_id ||
      session.user.role === UserRole.SUPER_ADMIN ||
      session.user.organization?.status !== OrganizationStatus.ACTIVE
    )
      throw new UnauthorizedException('Invalid session');
    return session;
  }

  async logoutTenant(payload: JwtPayload) {
    await this.database.tenantSession.updateMany({
      where: { id: payload.session_id, user_id: payload.sub },
      data: { revoked_at: new Date() },
    });
    return { success: true };
  }

  private async refreshTenant(decoded: JwtPayload, refreshToken: string) {
    const session = await this.validateTenant(decoded);
    const user = session.user;
    const previous = digest(refreshToken);
    if (previous !== session.refresh_hash)
      throw new UnauthorizedException('Invalid refresh token');
    const tokens = await this.generateTokens({
      sub: user.id,
      id: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      name: user.full_name,
      organization_id: user.organization_id,
      session_id: session.id,
    });
    const rotated = await this.database.tenantSession.updateMany({
      where: {
        id: session.id,
        refresh_hash: previous,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      data: { refresh_hash: digest(tokens.refreshToken) },
    });
    if (rotated.count !== 1)
      throw new UnauthorizedException('Invalid refresh token');
    return { ...tokens, user: toUserResponse(user) };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET');
      if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET is not set');
      const decoded = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: refreshSecret,
        algorithms: ['HS256'],
      });
      if (decoded.token_use !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (decoded.session_id)
        return await this.refreshTenant(decoded, dto.refreshToken);

      const user = await this.database.user.findUnique({
        where: { id: decoded.sub },
        include: { organization: { select: { status: true } } },
      });
      if (!user || !user.refresh_token) {
        throw new UnauthorizedException('Refresh token not found');
      }

      // Block org users if the organization is inactive.
      if (
        user.role !== UserRole.SUPER_ADMIN &&
        user.organization?.status !== OrganizationStatus.ACTIVE
      ) {
        throw new UnauthorizedException('Organization is inactive');
      }
      const previousDigest = this.refreshTokenDigest(dto.refreshToken);
      if (previousDigest !== user.refresh_token) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const payload: JwtPayload = {
        sub: user.id,
        id: user.id,
        role: user.role,
        email: user.email,
        phone: user.phone,
        name: user.full_name,
        organization_id: user.organization_id,
      };

      const tokens = await this.generateTokens(payload);
      // Consume this exact session once. A concurrent rotation, logout or
      // password change must never let a stale request restore a session.
      const rotated = await this.database.user.updateMany({
        where: { id: user.id, refresh_token: previousDigest },
        data: { refresh_token: this.refreshTokenDigest(tokens.refreshToken) },
      });
      if (rotated.count !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return {
        ...tokens,
        // Always return API-safe DTO, not raw DB entity.
        user: toUserResponse(user as any),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
