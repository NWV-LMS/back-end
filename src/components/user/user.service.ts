import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'generated/prisma/enums';
import { UserUpdateDto } from 'src/libs/dto/auth/userUpdate.dto';
import { InviteUserDto } from 'src/libs/dto/auth/invite-user.dto';
import { LoginDto, LoginResponseDto } from 'src/libs/dto/auth/login.dto';
import { User } from 'src/libs/dto/user/user-response.dto';
import { JwtPayload } from 'src/libs/types/auth';
import { T } from 'src/libs/types/common';
import { DatabaseService } from '../../database/database.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UserService {
  constructor(
    private database: DatabaseService,
    private authService: AuthService,
  ) {}

//* Login
  async login(input: LoginDto): Promise<LoginResponseDto> {
    console.log('User login service');
    const user = await this.database.user.findUnique({
      where: { phone: input.phone },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    console.log('User login service2');

    const passwordMatch = await bcrypt.compare(input.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    console.log('User login service3');

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      name: user.full_name,
      organization_id:
        user.role === UserRole.SUPER_ADMIN ? null : user.organization_id,
    };


    const tokens = await this.authService.generateTokens(payload);
    await this.authService.storeRefreshToken(user.id, tokens.refreshToken);

    const { password: _pw, refresh_token: _rt, ...safeUser } = user;
    return {
      ...tokens,
      user: this.authService.sanitizeUser(safeUser as unknown as User),
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

  //*** Update User */

  async updateUser(userId: string, input: UserUpdateDto): Promise<User> {
    const user = await this.database.user.update({
      where: { id: userId },
      data: {
        full_name: input.full_name,
        email: input.email,
        phone: input.phone,
      },
    }
  )

console.log(user,input)
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
console.log('User update', input);
      const hashed = await bcrypt.hash(input.new_password, 10);
      await this.database.user.update({
        where: { id: userId },
        data: {
          password: hashed,
          refresh_token: null, // force re-login
        } as T,
      });
    }

    return this.database.user.findUnique({
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
  }

  //** invite User */

  async inviteUser(input: InviteUserDto, currentOrgId: string):Promise<User> {
    console.log('input', input);
    
    // 1. SUPER_ADMIN yaratishni oldini olish
    if (input.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Cannot create SUPER_ADMIN from organization scope',
      );
    }

    // 2. Phone unique tekshirish (GLOBAL - login uchun)
    const existingByPhone = await this.database.user.findUnique({
      where: { phone: input.phone },
    });
    if (existingByPhone) {
      throw new BadRequestException(
        'User with this phone already exists',
      );
    }

    // 3. Email unique tekshirish (ORGANIZATION SCOPE)
    const existingByEmail = await this.database.user.findFirst({
      where: { 
        email: input.email,
        organization_id: currentOrgId,
      },
    });
    if (existingByEmail) {
      throw new BadRequestException(
        'User with this email already exists in your organization',
      );
    }

    // 4. Password hash (agar berilmasa random generate)
    const password = input.password ?? Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(password, 10);

    // 5. User yaratish
    const user = await this.database.user.create({
      data: {
        organization_id: currentOrgId,
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
      user,
      temporaryPassword: input.password ? undefined : password,
    };
  }
}
