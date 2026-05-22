import { forwardRef, Module } from '@nestjs/common';
import {
  PlatformController,
  OrganizationController,
} from './organization.controller';
import { UserModule } from '../user/user.module';
import { OrganizationService } from './organization.service';

@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [PlatformController, OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
