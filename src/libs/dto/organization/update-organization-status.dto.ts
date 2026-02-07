import { OrganizationStatus } from 'generated/prisma/enums';
import { IsEnum } from 'class-validator';

export class UpdateOrganizationStatusDto {
  @IsEnum(OrganizationStatus)
  status: OrganizationStatus;
}
