import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EmailDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}
export class AccountLoginDto extends EmailDto {
  @IsString() @MinLength(1) @MaxLength(128) password: string;
}
export class BrowserBindingDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43,128}$/) browser_binding: string;
}
export class RegisterAccountDto extends EmailDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  full_name: string;
  @IsString() @Length(12, 128) password: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{43,128}$/) browser_binding: string;
}
export class TokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token: string;
}
export class VerifyEmailDto extends TokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43,128}$/) browser_binding: string;
}
export class ResetPasswordDto extends TokenDto {
  @IsString() @Length(12, 128) password: string;
}
export class GoogleCallbackDto extends BrowserBindingDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) state: string;
  @IsString() @Length(1, 4096) code: string;
}
export class PhoneDto {
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone: string;
}
export class CreateCenterDto extends PhoneDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  name: string;
}
export class AcceptInvitationDto extends PhoneDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token: string;
}
export class OrganizationSelectionDto {
  @IsUUID() organization_id: string;
}
export class LinkLegacyDto extends PhoneDto {
  @IsString() @Length(1, 128) password: string;
}
export class CreateInvitationDto extends EmailDto {
  @IsIn(['TEACHER', 'MANAGER', 'STUDENT']) role:
    | 'TEACHER'
    | 'MANAGER'
    | 'STUDENT';
}
