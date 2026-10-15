import * as express from 'express';
import * as request from 'supertest';
import pinoHttp from 'pino-http';
import { lastValueFrom, of } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { LoggingInterceptor } from '../interceptor/logging.interceptor';
import { httpLoggingOptions, requestPath } from './http-logging';

describe('HTTP credential logging', () => {
  it('keeps useful HTTP metadata while omitting query/body/header/response secrets', async () => {
    let output = '';
    const secret = 'security-logging-regression-sentinel';
    const app = express();
    app.use(express.json());
    app.use(
      pinoHttp(
        { ...httpLoggingOptions(), transport: undefined, level: 'info' },
        { write: (line) => (output += line) },
      ),
    );
    app.post('/login', (_req, res) => {
      res.setHeader('set-cookie', `session=${secret}`);
      res.json({ accessToken: secret, password: secret });
    });

    await request(app)
      .post('/login')
      .query({
        refreshToken: secret,
        password: secret,
        nested: { token: secret },
      })
      .set('Authorization', `Bearer ${secret}`)
      .set('Cookie', `session=${secret}`)
      .set('X-Api-Key', secret)
      .send({ password: secret, refreshToken: secret })
      .expect(200);

    expect(output).not.toContain(secret);
    const log = JSON.parse(output.trim());
    expect(log.req.method).toBe('POST');
    expect(log.req.url).toBe('/login');
    expect(log.res.statusCode).toBe(200);
    expect(log.req).not.toHaveProperty('query');
    expect(log.req).not.toHaveProperty('headers');
  });

  it('omits credentials from interceptor URL logs as well', async () => {
    const interceptor = new LoggingInterceptor();
    const log = jest
      .spyOn((interceptor as any).logger, 'log')
      .mockImplementation();
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/api/auth/refresh?refreshToken=do-not-log',
          body: { password: 'do-not-log' },
        }),
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as ExecutionContext;

    await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ token: 'do-not-log' }),
      }),
    );
    expect(log).toHaveBeenCalledWith('POST /api/auth/refresh', 'REQUEST');
    expect(JSON.stringify(log.mock.calls)).not.toContain('do-not-log');
    log.mockRestore();
  });

  it('does not log URL user information or malformed URL contents', () => {
    expect(
      requestPath('https://user:private@example.test/path?secret=value'),
    ).toBe('/path');
    expect(requestPath('http://[invalid?secret=value')).toBe(
      '(invalid request path)',
    );
  });
});
