import { IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEnrollmentDto {
  @IsUUID('4', { message: 'student_id must be a valid UUID' })
  @IsNotEmpty({ message: 'student_id cannot be empty' })
  student_id: string;

  @IsUUID('4', { message: 'group_id must be a valid UUID' })
  @IsNotEmpty({ message: 'group_id cannot be empty' })
  group_id: string;

  // Override course price for this student (defaults to course price during invoicing if 0).
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'monthly_fee must be a number' })
  @Min(0, { message: 'monthly_fee must be >= 0' })
  monthly_fee?: number;

  // Absolute som discount subtracted from the monthly fee before invoicing.
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'discount_amount must be a number' })
  @Min(0, { message: 'discount_amount must be >= 0' })
  discount_amount?: number;
}
