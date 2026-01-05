import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { LeadStatus } from 'generated/prisma/enums';

export class CreateLeadDto {
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString()
  @MinLength(2)
  full_name: string;

  @IsNotEmpty({ message: 'Phone is required' })
  @IsString()
  @Matches(/^\+996\d{9}$/, {
    message: 'Phone must be in format +996XXXXXXXXX',
  })
  phone: string;

  @IsNotEmpty({ message: 'Source is required' })
  @IsString()
  source: string;

  @IsNotEmpty({ message: 'Admin name is required' })
  @IsString()
  admin: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;
}
