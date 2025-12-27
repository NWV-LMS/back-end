import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OrganizationsController } from './organizations.controller';
import { PlatformController } from './platform.controller';
import { JwtStrategy } from './strategies/jwt.strategy'
import { UserModule } from '../user/user.module'
import { UserService } from '../user/user.service'

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    forwardRef(() => UserModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_ACCESS_SECRET') || 'access-secret',
        signOptions: {
          expiresIn:
            configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController, PlatformController, OrganizationsController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
