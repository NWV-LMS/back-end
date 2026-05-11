import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ConvertLeadDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  parent?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
