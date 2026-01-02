import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PlatformController } from '../auth/platform.controller'
import { OrganizationsController } from '../auth/organizations.controller'

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    forwardRef(() => AuthModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:`${process.env.JWT_ACCESS_SECRET} || 'access-secret'`,
        signOptions: { expiresIn: `${process.env.JWT_ACCESS_EXPIRES_IN}` || '150000m' },
      }),
    }),
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
