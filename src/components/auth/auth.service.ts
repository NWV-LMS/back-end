import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { T } from '../../libs/types/common';
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
    const accessExpires = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN');
    const refreshExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');

    // Startup env validation should ensure these exist; keep runtime guard too.
    if (!accessSecret) throw new Error('JWT_ACCESS_SECRET is not set');
    if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET is not set');
    if (!accessExpires) throw new Error('JWT_ACCESS_EXPIRES_IN is not set');
    if (!refreshExpires) throw new Error('JWT_REFRESH_EXPIRES_IN is not set');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpires,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpires,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.database.user.update({
      where: { id: userId },
      data: { refresh_token: hashed } as T,
    });
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
      if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET is not set');
      const decoded = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: refreshSecret,
      });

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
      const match = await bcrypt.compare(dto.refreshToken, user.refresh_token);
      if (!match) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const payload: JwtPayload = {
        sub: user.id,
        id: user.id,
        role: user.role,
        email: user.email,
        phone: user.phone,
        name: user.full_name,
        organization_id:
          user.role === UserRole.SUPER_ADMIN ? null : user.organization_id,
      };

      const tokens = await this.generateTokens(payload);
      await this.storeRefreshToken(user.id, tokens.refreshToken);
      return {
        ...tokens,
        // Always return API-safe DTO, not raw DB entity.
        user: toUserResponse(user as any),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
