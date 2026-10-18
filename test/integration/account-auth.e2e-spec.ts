import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { AccountController } from '../../src/components/auth/accounts/account.controller';
import { AccountService } from '../../src/components/auth/accounts/account.service';
import { GoogleAccountService } from '../../src/components/auth/accounts/google-account.service';
import {
  AccountBffGuard,
  AccountSessionGuard,
} from '../../src/components/auth/accounts/account.guards';
import { randomToken } from '../../src/components/auth/accounts/account.security';

describe('Account HTTP contract (mock services, real validation/guards)', () => {
  let app: INestApplication;
  const secret = 'server-only-secret-with-at-least-32-characters';
  const accounts = {
    register: jest.fn().mockResolvedValue({ message: 'Check email' }),
    authenticate: jest.fn().mockRejectedValue(new Error('invalid')),
    me: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [
        AccountBffGuard,
        AccountSessionGuard,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            ACCOUNT_AUTH_ENABLED: 'true',
            AUTH_BFF_SECRET: secret,
          }),
        },
        { provide: AccountService, useValue: accounts },
        { provide: GoogleAccountService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('rejects browser/direct calls without the BFF secret', async () => {
    await request(app.getHttpServer())
      .post('/auth/accounts/register')
      .send({})
      .expect(401);
    expect(accounts.register).not.toHaveBeenCalled();
  });
  it('normalizes email before registration', async () => {
    await request(app.getHttpServer())
      .post('/auth/accounts/register')
      .set('x-auth-bff-secret', secret)
      .send({
        email: ' Alice@Example.com ',
        full_name: ' Alice ',
        password: 'long-safe-password',
        browser_binding: randomToken(),
      })
      .expect(201);
    expect(accounts.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'alice@example.com',
        full_name: 'Alice',
      }),
    );
  });
  it('rejects extra privilege claims', async () => {
    await request(app.getHttpServer())
      .post('/auth/accounts/register')
      .set('x-auth-bff-secret', secret)
      .send({
        email: 'alice@example.com',
        full_name: 'Alice',
        password: 'long-safe-password',
        browser_binding: randomToken(),
        role: 'SUPER_ADMIN',
      })
      .expect(400);
  });
  it('requires account bearer credentials for onboarding', async () => {
    await request(app.getHttpServer())
      .get('/auth/accounts/me')
      .set('x-auth-bff-secret', secret)
      .expect(401);
    expect(accounts.me).not.toHaveBeenCalled();
  });
});
