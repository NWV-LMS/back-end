import { IsOptional, IsString, MinLength } from 'class-validator';

export class InviteStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
