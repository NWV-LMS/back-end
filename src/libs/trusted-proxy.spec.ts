import * as express from 'express';
import * as request from 'supertest';
import { configureTrustedProxy } from './trusted-proxy';

describe('trusted proxy configuration', () => {
  function appWith(configured: string) {
    const app = express();
    configureTrustedProxy(app, configured);
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    return app;
  }

  it('ignores client-supplied forwarded IPs by default', async () => {
    const app = appWith('');
    const response = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.42')
      .expect(200);
    expect(response.body.ip).not.toBe('203.0.113.42');
  });

  it('uses forwarding only from an explicitly trusted proxy', async () => {
    const response = await request(appWith('loopback'))
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.42')
      .expect(200);
    expect(response.body.ip).toBe('203.0.113.42');
  });

  it('ignores forwarding from a source outside the configured proxy subnet', async () => {
    const response = await request(appWith('192.0.2.0/24'))
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.42')
      .expect(200);
    expect(response.body.ip).not.toBe('203.0.113.42');
  });

  it('supports an explicitly configured fixed proxy topology', async () => {
    const response = await request(appWith('1'))
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.42')
      .expect(200);
    expect(response.body.ip).toBe('203.0.113.42');
  });

  it.each(['true', '*', 'not-a-proxy-address'])(
    'rejects invalid or blanket trust configuration: %s',
    (value) => expect(() => appWith(value)).toThrow(),
  );
});
