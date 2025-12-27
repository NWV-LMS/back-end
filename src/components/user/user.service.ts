import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OrganizationStatus, UserRole } from 'generated/prisma/enums';
import { ChangePasswordDto } from 'src/libs/dto/auth/change-password.dto';
import { InviteUserDto } from 'src/libs/dto/auth/invite-user.dto';
import { LoginDto } from 'src/libs/dto/auth/login.dto';
import { CreateOrganizationDto } from 'src/libs/dto/organization/create-organization.dto';
import { Organ } from 'src/libs/dto/organization/organization-response.dto';
import { User } from 'src/libs/dto/user/user-response.dto';
import { JwtPayload } from 'src/libs/types/auth';
import { T } from 'src/libs/types/common';
import { DatabaseService } from '../../database/database.service';
import { CreateUserDto } from '../../libs/dto/user/create-user.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UserService {
  constructor(
    private database: DatabaseService,
    private authService: AuthService,
  ) {}

  //this only for organization
  /* 
  public async register(input: CreateOrganizationDto): Promise<Organ> {
    try {
      // Check if organization with name already exists
      const existingOrg = await this.database.organization.findUnique({
        where: { name: input.name },
      });

      if (existingOrg) {
        throw new BadRequestException('Organization with this name already exists');
      }

      // Hash admin password
      const hashedPassword = await bcrypt.hash(input.adminPassword, 10);

      // Create organization with admin user in transaction
      const result = await this.database.$transaction(async (tx) => {
        // Create organization
        const organization = await tx.organization.create({
          data: {
            name: input.name,
            status: OrganizationStatus.ACTIVE,
            phone: input.phone,
            email: input.email,
          },
        });

        // Create admin user for this organization
        const adminUser = await tx.user.create({
          data: {
            organization_id: organization.id,
            full_name: input.adminFullName,
            email: input.adminEmail,
            phone: input.adminPhone,
            password: hashedPassword,
            role: UserRole.ADMIN,
          },
        });

        return { organization, adminUser };
      });

      // Return organization response without sensitive data
      const { ...orgResponse } = result.organization;
      return {
        id: orgResponse.id,
        name: orgResponse.name,
        status: orgResponse.status,
        admin: {
          id: result.adminUser.id,
          email: result.adminUser.email,
          full_name: result.adminUser.full_name,
        },
        created_at: orgResponse.created_at,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to register organization');
    }
  }
 */

  public async register(input: CreateOrganizationDto): Promise<Organ> {
    try {
      const existingOrg = await this.database.organization.findUnique({
        where: { name: input.name },
      });

      if (existingOrg) {
        throw new BadRequestException('Organization already exists');
      }

      // 2. Admin email unique check
      const existingAdmin = await this.database.user.findUnique({
        where: { email: input.email },
      });

      if (existingAdmin) {
        throw new BadRequestException('Admin email already exists');
      }

      // 3. Password hash
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // 4. TRANSACTION (tx)
      const result = await this.database.$transaction(async (tx) => {
        // 4.1 Create organization
        const organization = await tx.organization.create({
          data: {
            name: input.name,
            email: input.email,
            phone: input.phone,
            status: OrganizationStatus.ACTIVE,
          },
        });

        // 4.2 Create ADMIN user
        const admin = await tx.user.create({
          data: {
            organization_id: organization.id,
            full_name: input.name,
            email: input.email,
            phone: input.phone,
            password: hashedPassword,
            role: UserRole.ADMIN,
            //*todo         status: UserStatus.ACTIVE,
          },
        });

        // 4.3 tx ichidan qaytariladigan data
        return { organization, admin };
      });

      // 5. Response (password yo‘q)
      return {
        organization_id: result.organization.id,
        name: result.organization.name,
        status: result.organization.status,
        email: result.organization.email, // ✅ Email qo'shildi
        phone: result.organization.phone, // ✅ Phone qo'shildi
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          full_name: result.admin.full_name,
        },
        created_at: result.organization.created_at,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
    }
  }

  //this only for users
  public async signup(input: CreateUserDto): Promise<User> {
    try {
      // Check if user with email already exists
      const existingUser = await this.database.user.findUnique({
        where: { email: input.email },
      });

      // Check if user with phone already exists
      // Note: Prisma might not recognize phone as unique in findUnique, so we use findFirst
      const existingPhone = await this.database.user.findFirst({
        where: {
          phone: {
            equals: input.phone,
          },
        },
      });

      if (existingPhone) {
        throw new BadRequestException('User with this phone already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create user
      const result = await this.database.user.create({
        data: {
          organization_id: input.organization_id,
          full_name: input.full_name,
          email: input.email,
          phone: input.phone,
          password: hashedPassword,
          role: input.role,
        },
      });

      // Return user without password
      const { password: _, ...userResponse } = result;
      return userResponse as User;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create user');
    }
  }

  //Login
  async login(dto: LoginDto) {
    const user = await this.database.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      organization_id:
        user.role === UserRole.SUPER_ADMIN ? null : user.organization_id,
    };

    const tokens = await this.authService.generateTokens(payload);
    await this.authService.storeRefreshToken(user.id, tokens.refreshToken);
    //@ts-ignore
    const { password: _pw, refresh_token: _rt, ...safeUser } = user;
    return {
      ...tokens,
      user: this.authService.sanitizeUser(safeUser as unknown as User),
    };
  }

  //***me */
  async me(userId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        organization_id: true,
        full_name: true,
        phone: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.authService.sanitizeUser(user as unknown as User);
  }

  //****  Logout */
  async logout(userId: string) {
    await this.database.user.update({
      where: { id: userId },
      data: { refresh_token: null } as T,
    });
    return { success: true };
  }

  //***Change Password */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { password: true, refresh_token: true } as T,
    });

    if (!user) {
      throw new UnauthorizedException();
    }
    //@ts-ignore
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.database.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        refresh_token: null, // force re-login
      } as T,
    });

    return { success: true };
  }

  //** create organization */
  // async createOrganization(dto: CreatePlatformOrganizationDto) {
  //   const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);

  //   const result = await this.database.$transaction(async (tx) => {
  //     const organization = await tx.organization.create({
  //       data: {
  //         name: dto.name,
  //         status: OrganizationStatus.ACTIVE,
  //         phone: dto.phone,
  //         email: dto.email,
  //       },
  //     });

  //     const adminUser = await tx.user.create({
  //       data: {
  //         organization_id: organization.id,
  //         full_name: dto.adminEmail,
  //         email: dto.adminEmail,
  //         phone: dto.adminEmail,
  //         password: hashedPassword,
  //         role: UserRole.ADMIN,
  //       },
  //     });

  //     return { organization, adminUser };
  //   });

  //   return {
  //     organization_id: result.organization.id,
  //     name: result.organization.name,
  //     admin_user_id: result.adminUser.id,
  //     admin_email: result.adminUser.email,
  //   };
  // }

  //** invite User */
  async inviteUser(dto: InviteUserDto, currentOrgId: string) {
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Cannot create SUPER_ADMIN from organization scope',
      );
    }

    const existing = await this.database.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('User already exists');
    }

    const password = dto.password ?? Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(password, 10);

    const user = await this.database.user.create({
      data: {
        organization_id: currentOrgId,
        full_name: dto.email,
        email: dto.email,
        phone: dto.email,
        password: hashed,
        role: dto.role,
      },
      select: {
        id: true,
        organization_id: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        created_at: true,
      },
    });

    return {
      user,
      temporaryPassword: dto.password ? undefined : password,
    };
  }
}
