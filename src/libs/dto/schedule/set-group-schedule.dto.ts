import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GroupScheduleItemDto {
  // ISO weekday: 1=Mon .. 7=Sun
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  day_of_week: number;

  // HH:MM (24h)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start_time: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(240)
  duration_minutes?: number = 120;
}

export class SetGroupScheduleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => GroupScheduleItemDto)
  items: GroupScheduleItemDto[];
}

