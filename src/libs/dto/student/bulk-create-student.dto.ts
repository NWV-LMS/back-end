import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStudentDto } from './create-student.dto';

export class BulkCreateStudentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentDto)
  students: CreateStudentDto[];
}
