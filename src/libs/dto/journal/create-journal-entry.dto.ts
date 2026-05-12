import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { JournalStatus } from '@prisma/client';

export class JournalEntryItemDto {
  @IsUUID()
  student_id: string;

  @IsEnum(JournalStatus)
  status: JournalStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateJournalEntryDto {
  @IsUUID()
  group_id: string;

  @IsDateString()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntryItemDto)
  entries: JournalEntryItemDto[];
}
