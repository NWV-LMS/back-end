import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ConvertLeadDto {
  @IsNotEmpty({ message: 'Address is required for student' })
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  parent?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
