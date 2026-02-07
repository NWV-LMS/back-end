import { forwardRef, Module } from '@nestjs/common';
import { PlatformController } from './organization.controller';
import { UserModule } from '../user/user.module';
import { OrganizationService } from './organization.service';

@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [PlatformController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
