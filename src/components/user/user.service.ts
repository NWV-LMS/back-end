import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OrganizationStatus, UserRole } from '@prisma/client';
import { UserUpdateDto } from '../../libs/dto/auth/userUpdate.dto';
import { InviteUserDto } from '../../libs/dto/auth/invite-user.dto';
import { LoginDto, LoginResponseDto } from '../../libs/dto/auth/login.dto';
import { User } from '../../libs/dto/user/user-response.dto';
import { JwtPayload } from '../../libs/types/auth';
import { T } from '../../libs/types/common';
import { toUserResponse } from '../../libs/mappers/user.mapper';
import { DatabaseService } from '../../database/database.service';
import { AuthService } from '../auth/auth.service';
import { QueryPlatformUserDto } from '../../libs/dto/user/query-platform-user.dto';
import { PaginatedUserResponseDto } from '../../libs/dto/user/paginated-user-response.dto';

@Injectable()
export class UserService {
  constructor(
    private database: DatabaseService,
    private authService: AuthService,
  ) {}

  //* Login
  async login(input: LoginDto): Promise<LoginResponseDto> {
    const user = await this.database.user.findUnique({
      where: { phone: input.phone },
      include: { organization: { select: { status: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Block org users if the organization is inactive.
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.organization?.status !== OrganizationStatus.ACTIVE
    ) {
      throw new ForbiddenException('Organization is inactive');
    }

    const passwordMatch = await bcrypt.compare(input.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload: JwtPayload = {
      sub: user.id,
      id: user.id, // Added id
      role: user.role,
      email: user.email,
      phone: user.phone,
      name: user.full_name,
      organization_id:
        user.role === UserRole.SUPER_ADMIN ? null : user.organization_id,
    };

    const tokens = await this.authService.generateTokens(payload);
    await this.authService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      // Always return API-safe DTO, not raw DB entity.
      user: toUserResponse(user),
    } as LoginResponseDto;
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
        updated_at: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    // Convert DB entity to response DTO.
    return toUserResponse(user as any);
  }

  //****  Logout */

  async logout(userId: string) {
    await this.database.user.update({
      where: { id: userId },
      data: { refresh_token: null } as T,
    });
    return { success: true };
  }

  //*** Update User */

  async updateUser(userId: string, input: UserUpdateDto): Promise<User> {
    const user = await this.database.user.update({
      where: { id: userId },
      data: {
        full_name: input.full_name,
        email: input.email,
        phone: input.phone,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    if (input.new_password) {
      if (!input.password) {
        throw new BadRequestException(
          'Current password is required to set a new password',
        );
      }

      const isMatch = await bcrypt.compare(input.password, user.password);
      if (!isMatch) {
        throw new BadRequestException('Current password is incorrect');
      }

      if (input.new_password !== input.confirm_new_password) {
        throw new BadRequestException('Passwords do not match');
      }
      const hashed = await bcrypt.hash(input.new_password, 10);
      await this.database.user.update({
        where: { id: userId },
        data: {
          password: hashed,
          refresh_token: null, // force re-login
        } as T,
      });
    }

    const updated = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        organization_id: true,
        full_name: true,
        phone: true,
        created_at: true,
        updated_at: true,
      },
    });
    // Convert DB entity to response DTO.
    return toUserResponse(updated as any);
  }

  /**
   * Invite a new user to the organization
   * Only ADMIN can invite users
   */
  async inviteUser(input: InviteUserDto, organizationId: string): Promise<any> {
    // Prevent SUPER_ADMIN creation from organization scope
    if (input.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Cannot create SUPER_ADMIN from organization scope',
      );
    }

    // Check phone uniqueness (GLOBAL - used for login)
    const existingByPhone = await this.database.user.findUnique({
      where: { phone: input.phone },
    });
    if (existingByPhone) {
      throw new BadRequestException('User with this phone already exists');
    }

    // Check email uniqueness (ORGANIZATION SCOPE)
    const existingByEmail = await this.database.user.findFirst({
      where: {
        email: input.email,
        organization_id: organizationId,
      },
    });
    if (existingByEmail) {
      throw new BadRequestException(
        'User with this email already exists in your organization',
      );
    }

    // Generate password if not provided
    const password = input.password ?? Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.database.user.create({
      data: {
        organization_id: organizationId,
        full_name: input.full_name,
        email: input.email,
        phone: input.phone,
        password: hashed,
        role: input.role,
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
      // Always return API-safe DTO, not raw DB entity.
      user: toUserResponse(user as any),
      temporaryPassword: input.password ? undefined : password,
    };
  }

  // statusiniham return qilish kk
  getAllUsers(): Promise<User[]> {
    return this.database.user
      .findMany({
      select: {
        id: true,
        email: true,
        role: true,
        organization_id: true,
        full_name: true,
        phone: true,
        created_at: true,
        updated_at: true,
      },
      })
      .then((users) => users.map((u) => toUserResponse(u as any)));
  }

  async listUsersForPlatform(
    query: QueryPlatformUserDto,
  ): Promise<PaginatedUserResponseDto> {
    const { page = 1, limit = 20, search, organization_id, role } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (organization_id) where.organization_id = organization_id;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.database.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          organization_id: true,
          full_name: true,
          phone: true,
          created_at: true,
          updated_at: true,
        },
      }),
      this.database.user.count({ where }),
    ]);

    return {
      items: items.map((u) => toUserResponse(u as any)),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
