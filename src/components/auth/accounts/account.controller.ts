import { AccountContext } from './account.service';
import { JwtPayload } from '../../../libs/types/auth';
type AccountRequest = { accountContext: AccountContext; user: JwtPayload };
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccountService } from './account.service';
import { GoogleAccountService } from './google-account.service';
import { AccountBffGuard, AccountSessionGuard } from './account.guards';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  AcceptInvitationDto,
  AccountLoginDto,
  BrowserBindingDto,
  CreateCenterDto,
  CreateInvitationDto,
  EmailDto,
  GoogleCallbackDto,
  LinkLegacyDto,
  OrganizationSelectionDto,
  RegisterAccountDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './account.dto';

@Controller('auth/accounts')
@UseGuards(AccountBffGuard)
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class AccountController {
  constructor(
    private readonly accounts: AccountService,
    private readonly google: GoogleAccountService,
  ) {}
  @Post('register') register(@Body() dto: RegisterAccountDto) {
    return this.accounts.register(dto);
  }
  @Post('verify-email') verify(@Body() dto: VerifyEmailDto) {
    return this.accounts.verifyEmail(dto);
  }
  @Post('login') login(@Body() dto: AccountLoginDto) {
    return this.accounts.login(dto);
  }
  @Post('forgot-password') forgot(@Body() dto: EmailDto) {
    return this.accounts.forgotPassword(dto.email);
  }
  @Post('reset-password') reset(@Body() dto: ResetPasswordDto) {
    return this.accounts.resetPassword(dto);
  }
  @Post('google/start') googleStart(@Body() dto: BrowserBindingDto) {
    return this.google.start(dto.browser_binding);
  }
  @Post('google/callback') googleCallback(@Body() dto: GoogleCallbackDto) {
    return this.google.callback(dto);
  }
  @Post('google/link') @UseGuards(AccountSessionGuard) googleLink(
    @Req() req: AccountRequest,
    @Body() dto: BrowserBindingDto,
  ) {
    return this.google.start(dto.browser_binding, req.accountContext);
  }
  @Get('me') @UseGuards(AccountSessionGuard) me(@Req() req: AccountRequest) {
    return this.accounts.me(req.accountContext);
  }
  @Post('logout') @UseGuards(AccountSessionGuard) logout(
    @Req() req: AccountRequest,
  ) {
    return this.accounts.logout(req.accountContext);
  }
  @Post('centers') @UseGuards(AccountSessionGuard) center(
    @Req() req: AccountRequest,
    @Body() dto: CreateCenterDto,
  ) {
    return this.accounts.createCenter(req.accountContext, dto);
  }
  @Post('select-organization') @UseGuards(AccountSessionGuard) select(
    @Req() req: AccountRequest,
    @Body() dto: OrganizationSelectionDto,
  ) {
    return this.accounts.selectOrganization(
      req.accountContext,
      dto.organization_id,
    );
  }
  @Post('link-legacy') @UseGuards(AccountSessionGuard) link(
    @Req() req: AccountRequest,
    @Body() dto: LinkLegacyDto,
  ) {
    return this.accounts.linkLegacy(req.accountContext, dto);
  }
  @Post('invitations') @UseGuards(JwtAuthGuard) invite(
    @Req() req: AccountRequest,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.accounts.createInvitation(
      req.user.sub,
      req.user.organization_id ?? '',
      dto,
    );
  }
  @Post('accept-invitation') @UseGuards(AccountSessionGuard) accept(
    @Req() req: AccountRequest,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.accounts.acceptInvitation(req.accountContext, dto);
  }
}
