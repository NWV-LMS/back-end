import { AccountController } from './accounts/account.controller';
import { AccountService } from './accounts/account.service';
import { AccountMailService } from './accounts/account-mail.service';
import { GoogleAccountService } from './accounts/google-account.service';
import {
  AccountBffGuard,
  AccountSessionGuard,
} from './accounts/account.guards';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../../database/database.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OrganizationsController } from './organizations.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OrganizationActiveGuard } from './guards/organization-active.guard';
import { UserModule } from '../user/user.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    forwardRef(() => UserModule),
    DatabaseModule,
    OrganizationModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, OrganizationsController, AccountController],
  providers: [
    AuthService,
    JwtStrategy,
    OrganizationActiveGuard,
    AccountService,
    AccountMailService,
    GoogleAccountService,
    AccountBffGuard,
    AccountSessionGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
