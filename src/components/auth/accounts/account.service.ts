import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Account, AccountSession, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../../database/database.service';
import { AuthService } from '../auth.service';
import { toUserResponse } from '../../../libs/mappers/user.mapper';
import { AccountMailService } from './account-mail.service';
import {
  AcceptInvitationDto,
  AccountLoginDto,
  CreateCenterDto,
  CreateInvitationDto,
  LinkLegacyDto,
  RegisterAccountDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './account.dto';
import {
  after,
  checkPassword,
  digest,
  GENERIC_EMAIL_RESPONSE,
  hashPassword,
  randomToken,
  safeEqual,
} from './account.security';

export type AccountContext = AccountSession & { account: Account };
export const accountView = (account: Account) => ({
  id: account.id,
  email: account.email,
  full_name: account.full_name,
  email_verified: Boolean(account.email_verified_at),
});

@Injectable()
export class AccountService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
    private readonly mail: AccountMailService,
  ) {}

  async register(dto: RegisterAccountDto) {
    this.mail.assertConfigured();
    const pendingPassword = await hashPassword(dto.password);
    const account = await this.db.account.upsert({
      where: { email: dto.email },
      update: {},
      create: { email: dto.email, full_name: dto.full_name.trim() },
    });
    if (account.email_verified_at || account.disabled_at)
      return GENERIC_EMAIL_RESPONSE;
    const token = randomToken();
    await this.db.accountToken.create({
      data: {
        account_id: account.id,
        token_hash: digest(token),
        purpose: 'verify',
        binding_hash: digest(dto.browser_binding),
        pending_password_hash: pendingPassword,
        pending_name: dto.full_name.trim(),
        auth_version: account.auth_version,
        expires_at: after(1800),
      },
    });
    try {
      await this.mail.send(account.email, 'verify-email', token);
    } catch {
      /* Keep delivery status private; registration can be retried. */
    }
    return GENERIC_EMAIL_RESPONSE;
  }

  async verifyEmail(dto: VerifyEmailDto) {
    await this.db.$transaction(async (tx) => {
      const token = await tx.accountToken.findUnique({
        where: { token_hash: digest(dto.token) },
      });
      if (
        !token ||
        token.purpose !== 'verify' ||
        token.consumed_at ||
        token.expires_at <= new Date() ||
        !token.pending_password_hash ||
        !safeEqual(token.binding_hash ?? '', digest(dto.browser_binding))
      )
        throw new BadRequestException('Invalid or expired verification');
      const consumed = await tx.accountToken.updateMany({
        where: {
          id: token.id,
          consumed_at: null,
          expires_at: { gt: new Date() },
        },
        data: { consumed_at: new Date() },
      });
      if (consumed.count !== 1)
        throw new BadRequestException('Invalid or expired verification');
      const updated = await tx.account.updateMany({
        where: {
          id: token.account_id,
          email_verified_at: null,
          disabled_at: null,
          auth_version: token.auth_version,
        },
        data: {
          email_verified_at: new Date(),
          password_hash: token.pending_password_hash,
          full_name: token.pending_name!,
          auth_version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new BadRequestException('Invalid or expired verification');
      await tx.accountToken.updateMany({
        where: { account_id: token.account_id, purpose: 'verify' },
        data: { pending_password_hash: null, binding_hash: null },
      });
    });
    return { verified: true };
  }

  async login(dto: AccountLoginDto) {
    const account = await this.db.account.findUnique({
      where: { email: dto.email },
    });
    const match = await checkPassword(dto.password, account?.password_hash);
    if (!account || !match || !account.email_verified_at || account.disabled_at)
      throw new UnauthorizedException('Invalid credentials');
    return this.openSession(account);
  }

  async openSession(account: Account) {
    if (!account.email_verified_at || account.disabled_at)
      throw new UnauthorizedException('Account unavailable');
    const sessionToken = randomToken();
    const session = await this.db.accountSession.create({
      data: {
        account_id: account.id,
        token_hash: digest(sessionToken),
        auth_version: account.auth_version,
        expires_at: after(30 * 86400),
      },
    });
    return {
      account: accountView(account),
      accountSessionToken: sessionToken,
      expiresAt: session.expires_at,
    };
  }

  async authenticate(token: string): Promise<AccountContext> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException('Invalid account session');
    const session = await this.db.accountSession.findUnique({
      where: { token_hash: digest(token) },
      include: { account: true },
    });
    return this.assertSession(session);
  }

  assertSession(session: AccountContext | null): AccountContext {
    if (
      !session ||
      session.revoked_at ||
      session.expires_at <= new Date() ||
      session.account.disabled_at ||
      !session.account.email_verified_at ||
      session.auth_version !== session.account.auth_version
    )
      throw new UnauthorizedException('Invalid account session');
    return session;
  }

  async me(context: AccountContext) {
    const memberships = await this.db.user.findMany({
      where: {
        account_id: context.account_id,
        role: { not: UserRole.SUPER_ADMIN },
      },
      select: {
        organization_id: true,
        role: true,
        organization: { select: { name: true, status: true } },
      },
    });
    return {
      account: accountView(context.account),
      memberships,
      onboardingRequired: memberships.length === 0,
    };
  }

  async logout(context: AccountContext) {
    await this.db.accountSession.updateMany({
      where: { id: context.id, account_id: context.account_id },
      data: { revoked_at: new Date() },
    });
    return { success: true };
  }

  async forgotPassword(email: string) {
    this.mail.assertConfigured();
    const account = await this.db.account.findUnique({ where: { email } });
    if (account?.email_verified_at && !account.disabled_at) {
      const token = randomToken();
      await this.db.accountToken.create({
        data: {
          account_id: account.id,
          purpose: 'reset',
          token_hash: digest(token),
          auth_version: account.auth_version,
          expires_at: after(1800),
        },
      });
      // Same outward response even when SMTP fails, to avoid account enumeration.
      try {
        await this.mail.send(email, 'reset-password', token);
      } catch {
        /* resend is safe; never expose delivery state */
      }
    }
    return GENERIC_EMAIL_RESPONSE;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const passwordHash = await hashPassword(dto.password);
    await this.db.$transaction(async (tx) => {
      const token = await tx.accountToken.findUnique({
        where: { token_hash: digest(dto.token) },
      });
      if (
        !token ||
        token.purpose !== 'reset' ||
        token.consumed_at ||
        token.expires_at <= new Date()
      )
        throw new BadRequestException('Invalid or expired reset');
      const consumed = await tx.accountToken.updateMany({
        where: {
          id: token.id,
          consumed_at: null,
          expires_at: { gt: new Date() },
        },
        data: { consumed_at: new Date() },
      });
      if (consumed.count !== 1)
        throw new BadRequestException('Invalid or expired reset');
      const changed = await tx.account.updateMany({
        where: {
          id: token.account_id,
          disabled_at: null,
          email_verified_at: { not: null },
          auth_version: token.auth_version,
        },
        data: { password_hash: passwordHash, auth_version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new BadRequestException('Invalid or expired reset');
      // Version invalidates all account AND tenant sessions, including concurrent logins.
      await tx.accountSession.updateMany({
        where: { account_id: token.account_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    });
    return { success: true };
  }

  async createCenter(context: AccountContext, dto: CreateCenterDto) {
    const password = await bcrypt.hash(randomToken(), 10);
    return this.conflicts(async () =>
      this.db.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: dto.name.trim(),
            email: context.account.email,
            phone: dto.phone,
            status: 'ACTIVE',
          },
        });
        await tx.user.create({
          data: {
            account_id: context.account_id,
            organization_id: organization.id,
            email: context.account.email,
            full_name: context.account.full_name,
            phone: dto.phone,
            password,
            role: 'ADMIN',
          },
        });
        return { organization_id: organization.id };
      }),
    );
  }

  async selectOrganization(context: AccountContext, organizationId: string) {
    const user = await this.db.user.findFirst({
      where: {
        account_id: context.account_id,
        organization_id: organizationId,
        role: { not: UserRole.SUPER_ADMIN },
      },
      include: { organization: true },
    });
    if (!user || user.organization.status !== 'ACTIVE')
      throw new ForbiddenException('Active membership required');
    const sessionId = randomToken(); // UUID id is supplied by the DB; create before signing.
    const tenant = await this.db.tenantSession.create({
      data: {
        user_id: user.id,
        account_session_id: context.id,
        refresh_hash: digest(sessionId),
        expires_at: new Date(
          Math.min(after(7 * 86400).getTime(), context.expires_at.getTime()),
        ),
      },
    });
    const tokens = await this.auth.generateTokens({
      sub: user.id,
      id: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      name: user.full_name,
      organization_id: user.organization_id,
      session_id: tenant.id,
    });
    await this.db.tenantSession.update({
      where: { id: tenant.id },
      data: { refresh_hash: digest(tokens.refreshToken) },
    });
    return { ...tokens, user: toUserResponse(user) };
  }

  async linkLegacy(context: AccountContext, dto: LinkLegacyDto) {
    const user = await this.db.user.findUnique({ where: { phone: dto.phone } });
    // Hash a fixed dummy when no record exists to keep the cost comparable.
    const match = await bcrypt.compare(
      dto.password,
      user?.password ??
        '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    );
    if (
      !user ||
      !match ||
      user.role === 'SUPER_ADMIN' ||
      (user.account_id && user.account_id !== context.account_id)
    )
      throw new UnauthorizedException('Unable to link membership');
    return this.conflicts(async () => {
      const updated = await this.db.user.updateMany({
        where: {
          id: user.id,
          password: user.password,
          OR: [{ account_id: null }, { account_id: context.account_id }],
        },
        data: { account_id: context.account_id },
      });
      if (updated.count !== 1)
        throw new UnauthorizedException('Unable to link membership');
      return { linked: true };
    });
  }

  async createInvitation(
    adminId: string,
    organizationId: string,
    dto: CreateInvitationDto,
  ) {
    this.mail.assertConfigured();
    // Re-read current privilege; do not trust a stale role claim from legacy JWTs.
    const admin = await this.db.user.findFirst({
      where: {
        id: adminId,
        organization_id: organizationId,
        role: 'ADMIN',
        organization: { status: 'ACTIVE' },
      },
    });
    if (!admin || !['TEACHER', 'MANAGER', 'STUDENT'].includes(dto.role))
      throw new ForbiddenException('Administrator required');
    const token = randomToken();
    const invite = await this.db.accountInvitation.create({
      data: {
        organization_id: organizationId,
        invited_by: admin.id,
        email: dto.email,
        role: dto.role,
        token_hash: digest(token),
        expires_at: after(7 * 86400),
      },
    });
    try {
      await this.mail.send(dto.email, 'accept-invitation', token);
    } catch (error) {
      await this.db.accountInvitation.update({
        where: { id: invite.id },
        data: { revoked_at: new Date() },
      });
      throw error;
    }
    return { invitation_id: invite.id, expires_at: invite.expires_at };
  }

  async acceptInvitation(context: AccountContext, dto: AcceptInvitationDto) {
    const password = await bcrypt.hash(randomToken(), 10);
    return this.conflicts(async () =>
      this.db.$transaction(async (tx) => {
        const invite = await tx.accountInvitation.findUnique({
          where: { token_hash: digest(dto.token) },
        });
        if (
          !invite ||
          invite.email !== context.account.email ||
          invite.consumed_at ||
          invite.revoked_at ||
          invite.expires_at <= new Date() ||
          !['TEACHER', 'MANAGER', 'STUDENT'].includes(invite.role)
        )
          throw new BadRequestException('Invalid invitation');
        const admin = await tx.user.findFirst({
          where: {
            id: invite.invited_by,
            role: 'ADMIN',
            organization_id: invite.organization_id,
            organization: { status: 'ACTIVE' },
          },
        });
        if (!admin) throw new BadRequestException('Invalid invitation');
        const consumed = await tx.accountInvitation.updateMany({
          where: {
            id: invite.id,
            consumed_at: null,
            revoked_at: null,
            expires_at: { gt: new Date() },
          },
          data: { consumed_at: new Date() },
        });
        if (consumed.count !== 1)
          throw new BadRequestException('Invalid invitation');
        await tx.user.create({
          data: {
            account_id: context.account_id,
            organization_id: invite.organization_id,
            email: context.account.email,
            full_name: context.account.full_name,
            phone: dto.phone,
            password,
            role: invite.role,
            ...(invite.role === 'TEACHER'
              ? { teacherProfile: { create: { subjects: [] } } }
              : {}),
            ...(invite.role === 'STUDENT'
              ? {
                  studentProfile: {
                    create: {
                      organization_id: invite.organization_id,
                      name: context.account.full_name,
                      email: context.account.email,
                      phone: dto.phone,
                      status: 'ACTIVE' as const,
                    },
                  },
                }
              : {}),
          },
        });
        return { organization_id: invite.organization_id };
      }),
    );
  }

  private async conflicts<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Organization or membership already exists; link an existing membership using its credentials',
        );
      throw error;
    }
  }
}
