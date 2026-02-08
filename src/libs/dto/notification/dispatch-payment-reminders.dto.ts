import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { WhatsAppLanguageCode } from '../../notification/whatsapp-templates';

export class DispatchPaymentRemindersDto {
  // YYYY-MM. Default: current month.
  @IsOptional()
  @IsString()
  month?: string;

  // Remind invoices due within N days (default 3). Overdue invoices are included regardless.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  daysAhead?: number = 3;

  // Message language for WhatsApp templates. Default: WHATSAPP_DEFAULT_LANG or 'uz'.
  @IsOptional()
  @IsString()
  lang?: WhatsAppLanguageCode;
}
