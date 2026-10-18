import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AccountMailService {
  constructor(private readonly config: ConfigService) {}

  assertConfigured() {
    for (const name of [
      'AUTH_APP_URL',
      'AUTH_SMTP_HOST',
      'AUTH_SMTP_USER',
      'AUTH_SMTP_PASSWORD',
      'AUTH_MAIL_FROM',
    ]) {
      if (!this.config.get<string>(name))
        throw new ServiceUnavailableException(
          'Account email is not configured',
        );
    }
    const url = new URL(this.config.getOrThrow<string>('AUTH_APP_URL'));
    if (
      url.username ||
      url.password ||
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          process.env.NODE_ENV !== 'production' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)
        ))
    ) {
      throw new ServiceUnavailableException('Invalid account application URL');
    }
  }

  async send(
    email: string,
    purpose: 'verify-email' | 'reset-password' | 'accept-invitation',
    token: string,
  ) {
    this.assertConfigured();
    const url = new URL(
      `/${purpose}`,
      this.config.getOrThrow<string>('AUTH_APP_URL'),
    );
    // Fragment is not sent in HTTP requests or referrers. Frontend reads it, clears
    // browser history, and POSTs it through the BFF after explicit user action.
    url.hash = new URLSearchParams({ token }).toString();
    const port = Number(this.config.get('AUTH_SMTP_PORT') ?? 587);
    const transport = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('AUTH_SMTP_HOST'),
      port,
      secure: port === 465,
      requireTLS: true,
      auth: {
        user: this.config.getOrThrow<string>('AUTH_SMTP_USER'),
        pass: this.config.getOrThrow<string>('AUTH_SMTP_PASSWORD'),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
    });
    try {
      await transport.sendMail({
        from: this.config.getOrThrow<string>('AUTH_MAIL_FROM'),
        to: email,
        subject: `Bilim Nuru: ${purpose}`,
        text: `Continue with Bilim Nuru:\n${url.toString()}\n\nIf you did not request this, ignore this email.`,
      });
    } catch {
      // Never log the provider error: it may contain the message/token or auth.
      throw new ServiceUnavailableException(
        'Account email could not be delivered',
      );
    } finally {
      transport.close();
    }
  }
}
