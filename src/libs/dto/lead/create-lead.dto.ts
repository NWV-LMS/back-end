import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { LeadStatus } from '@prisma/client';

export class CreateLeadDto {
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString()
  @MinLength(2)
  full_name: string;

  @IsNotEmpty({ message: 'Phone is required' })
  @IsString()
  @Matches(/^\+?\d{9,15}$/, {
    message: 'Phone must be 9-15 digits, optional + prefix',
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
