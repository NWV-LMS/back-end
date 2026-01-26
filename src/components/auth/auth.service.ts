import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OrganizationStatus, UserRole } from 'generated/prisma/enums';
import { CreateOrganizationDto } from 'src/libs/dto/organization/create-organization.dto';
import { UpdateOrganizationDto } from 'src/libs/dto/organization/update-organization.dto';
import { Organ } from 'src/libs/dto/organization/organization-response.dto';
import { Message } from 'src/libs/enums/common.enums';
import { T } from 'src/libs/types/common';
import { DatabaseService } from '../../database/database.service';
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

  //**this only for organization

  public async register(input: CreateOrganizationDto): Promise<Organ> {
    const existingOrg = await this.database.organization.findUnique({
      where: { name: input.Org_name },
    });

    if (existingOrg) {
      throw new BadRequestException('Organization already exists');
    }

    // 2. Admin email unique check
    const existingAdmin = await this.database.user.findUnique({
      where: { email: input.adminEmail },
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin email already exists');
    }

    // 3. Password hash
    const hashedPassword = await bcrypt.hash(input.password, 10);

    try {
      // 4. TRANSACTION (tx)
      const result = await this.database.$transaction(async (tx) => {
        console.log('*** Transaction started ***');
        // 4.1 Create organization
        const organization = await tx.organization.create({
          data: {
            name: input.Org_name,
            email: input.Org_email,
            phone: input.phone,
            //*todo
            status: OrganizationStatus.ACTIVE,
          },
        });
        console.log('result', organization);

        // 4.2 Create ADMIN user
        const admin = await tx.user.create({
          data: {
            organization_id: organization.id,
            full_name: input.adminName,
            email: input.adminEmail,
            phone: input.phone,
            password: hashedPassword,
            role: input.adminRole,
            //*todo         status: UserStatus.ACTIVE,
          },
        });

        // 4.3 tx ichidan qaytariladigan data
        return { organization, admin };
      });
      console.log('*** Transaction committed ***');
      // 5. Response (password yoq)
      return {
        organization_id: result.organization.id,
        Org_name: result.organization.name,
        Org_status: result.organization.status,
        Org_email: result.organization.email,
        id: result.admin.id,
        adminEmail: result.admin.email,
        adminName: result.admin.full_name,
        phone: result.admin.phone,
        adminRole: result.admin.role,
        created_at: result.organization.created_at,
      };
    } catch (error) {
      console.error('Registration error:', error.message);
      throw new InternalServerErrorException(Message.CREATE_FAILED);
    }
  }

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
      updated_at: user.updated_at,
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
      if (!user || !user.refresh_token) {
        throw new UnauthorizedException('Refresh token not found');
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

      this.sanitizeUser(user as any); // Use sanitizeUser helper
      const tokens = await this.generateTokens(payload);
      await this.storeRefreshToken(user.id, tokens.refreshToken);
      const safeUser = this.sanitizeUser(user as any);
      return {
        ...tokens,
        user: safeUser,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
  async updateOrganization(
    orgId: string,
    input: UpdateOrganizationDto,
  ): Promise<Organ> {
    const existing = await this.database.organization.findUnique({
      where: { id: orgId },
    });

    if (!existing) {
      throw new BadRequestException('Organization not found');
    }

    const updated = await this.database.organization.update({
      where: { id: orgId },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        status: input.status,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        created_at: true,
      },
    });

    return {
      organization_id: updated.id,
      Org_name: updated.name,
      Org_email: updated.email,
      Org_status: updated.status,
      created_at: updated.created_at,
    } as Organ;
  }
}
