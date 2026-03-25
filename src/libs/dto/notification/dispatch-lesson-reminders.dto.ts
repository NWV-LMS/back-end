import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { WhatsAppLanguageCode } from '../../notification/whatsapp-templates';

export class DispatchLessonRemindersDto {
  // Remind sessions starting within N minutes from now (default 180).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(24 * 60)
  minutesAhead?: number = 180;

  // Message language for WhatsApp templates. Default: WHATSAPP_DEFAULT_LANG or 'uz'.
  @IsOptional()
  @IsString()
  lang?: WhatsAppLanguageCode;
}
