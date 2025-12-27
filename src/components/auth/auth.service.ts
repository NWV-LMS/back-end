import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OrganizationStatus, UserRole } from 'generated/prisma/enums';
import { T } from 'src/libs/types/common';
import { DatabaseService } from '../../database/database.service';
import { ChangePasswordDto } from '../../libs/dto/auth/change-password.dto';
import { CreatePlatformOrganizationDto } from '../../libs/dto/auth/create-platform-organization.dto';
import { InviteUserDto } from '../../libs/dto/auth/invite-user.dto';
import { RefreshTokenDto } from '../../libs/dto/auth/refresh-token.dto';
import { User } from '../../libs/dto/user/user-response.dto';
import { JwtPayload, JwtTokens } from '../../libs/types/auth';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokens(payload: JwtPayload): Promise<JwtTokens> {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') || 'access-secret';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret';
    const accessExpires =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const refreshExpires =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

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

  sanitizeUser(user: User): User {
    return {
      id: user.id,
      organization_id: user.organization_id ?? null,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      created_at: user.created_at,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'refresh-secret';
      const decoded = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.database.user.findUnique({
        where: { id: decoded.sub },
      });
      //@ts-ignore
      if (!user || !user.refresh_token) {
        throw new UnauthorizedException('Refresh token not found');
      }
      //@ts-ignore
      const match = await bcrypt.compare(dto.refreshToken, user.refresh_token);
      if (!match) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const payload: JwtPayload = {
        sub: user.id,
        role: user.role,
        organization_id:
          user.role === UserRole.SUPER_ADMIN ? null : user.organization_id,
      };

      const tokens = await this.generateTokens(payload);
      await this.storeRefreshToken(user.id, tokens.refreshToken);
      //@ts-ignore
      const { password: _pw, refresh_token: _rt, ...safeUser } = user;
      return {
        ...tokens,
        user: this.sanitizeUser(safeUser as unknown as User),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

}
