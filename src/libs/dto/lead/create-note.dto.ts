import { IsNotEmpty, IsString } from 'class-validator';

export class CreateNoteDto {
  @IsNotEmpty({ message: 'Content is required' })
  @IsString()
  content: string;
}
