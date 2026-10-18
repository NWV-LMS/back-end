import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHash } from 'crypto';
import { DatabaseService } from '../../../database/database.service';
import { encryptSecret, decryptSecret } from '../../../libs/crypto/secrets';
import { AccountContext, AccountService } from './account.service';
import { GoogleCallbackDto } from './account.dto';
import { after, digest, randomToken, safeEqual } from './account.security';

@Injectable()
export class GoogleAccountService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly accounts: AccountService,
  ) {}
  private client() {
    const id = this.config.get<string>('GOOGLE_CLIENT_ID');
    const secret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirect = this.config.get<string>('GOOGLE_REDIRECT_URI');
    if (!id || !secret || !redirect)
      throw new ServiceUnavailableException(
        'Google authentication is not configured',
      );
    return new OAuth2Client(id, secret, redirect);
  }
  async start(binding: string, session?: AccountContext) {
    const client = this.client();
    const state = randomToken(),
      nonce = randomToken(),
      verifier = randomToken();
    await this.db.googleAuthAttempt.create({
      data: {
        state_hash: digest(state),
        binding_hash: digest(binding),
        nonce,
        verifier_encrypted: encryptSecret(verifier),
        link_session_id: session?.id,
        expires_at: after(600),
      },
    });
    return {
      authorizationUrl: client.generateAuthUrl({
        scope: ['openid', 'email', 'profile'],
        state,
        nonce,
        code_challenge: createHash('sha256')
          .update(verifier)
          .digest('base64url'),
        code_challenge_method: 'S256' as any,
      }),
    };
  }
  async callback(dto: GoogleCallbackDto) {
    const client = this.client();
    const attempt = await this.db.googleAuthAttempt.findUnique({
      where: { state_hash: digest(dto.state) },
    });
    if (
      !attempt ||
      attempt.consumed_at ||
      attempt.expires_at <= new Date() ||
      !safeEqual(attempt.binding_hash, digest(dto.browser_binding))
    )
      throw new BadRequestException('Invalid Google callback');
    const used = await this.db.googleAuthAttempt.updateMany({
      where: {
        id: attempt.id,
        consumed_at: null,
        expires_at: { gt: new Date() },
      },
      data: { consumed_at: new Date() },
    });
    if (used.count !== 1)
      throw new BadRequestException('Invalid Google callback');
    let identity: { sub: string; email: string; name?: string };
    try {
      const verifier = decryptSecret(attempt.verifier_encrypted);
      if (!verifier) throw new Error('Invalid verifier');
      const { tokens } = await client.getToken({
        code: dto.code,
        codeVerifier: verifier,
      });
      if (!tokens.id_token) throw new Error('Missing identity');
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (
        !payload?.sub ||
        !payload.email ||
        !payload.email_verified ||
        !safeEqual((payload as any).nonce ?? '', attempt.nonce)
      )
        throw new Error('Invalid identity');
      identity = {
        sub: payload.sub,
        email: payload.email.trim().toLowerCase(),
        name: payload.name,
      };
    } catch {
      throw new BadRequestException('Google authentication failed');
    }
    if (attempt.link_session_id) {
      const session = this.accounts.assertSession(
        await this.db.accountSession.findUnique({
          where: { id: attempt.link_session_id },
          include: { account: true },
        }),
      );
      try {
        await this.db.authIdentity.create({
          data: {
            provider: 'google',
            subject: identity.sub,
            account_id: session.account_id,
          },
        });
      } catch {
        throw new ConflictException('Google identity is already linked');
      }
      return { linked: true };
    }
    const existing = await this.db.authIdentity.findUnique({
      where: {
        provider_subject: { provider: 'google', subject: identity.sub },
      },
      include: { account: true },
    });
    if (existing) return this.accounts.openSession(existing.account);
    // Email is not proof of ownership of an existing local account. Link only
    // after authenticating that account through the separate linking flow.
    let account;
    try {
      account = await this.db.account.create({
        data: {
          email: identity.email,
          full_name: (identity.name || identity.email).slice(0, 100),
          email_verified_at: new Date(),
          identities: { create: { provider: 'google', subject: identity.sub } },
        },
      });
    } catch {
      throw new ConflictException(
        'Sign in to your existing account and link Google',
      );
    }
    return this.accounts.openSession(account);
  }
}
