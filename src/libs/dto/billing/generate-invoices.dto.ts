import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateInvoicesDto {
  // YYYY-MM (e.g., 2026-02)
  @IsNotEmpty()
  @IsString()
  month: string;
}

