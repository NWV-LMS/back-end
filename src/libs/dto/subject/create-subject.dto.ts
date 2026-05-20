import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;
}
