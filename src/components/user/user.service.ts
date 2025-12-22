import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from 'src/libs/dto/user/user-response.dto';
import { DatabaseService } from '../../database/database.service';
import { CreateUserDto } from '../../libs/dto/user/create-user.dto';

@Injectable()
export class UserService {
  constructor(private database: DatabaseService) {}

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
}
