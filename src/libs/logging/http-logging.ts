import { Options } from 'pino-http';

export function requestPath(url?: string): string {
  try {
    // Log the path only: query strings can contain credentials or personal data.
    return new URL(url ?? '/', 'http://localhost').pathname;
  } catch {
    return '(invalid request path)';
  }
}

export function httpLoggingOptions(): Options {
  return {
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
    level: process.env.LOG_LEVEL ?? 'info',
    // Explicit serializers also omit query/params, bodies and credential headers.
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: requestPath(req.url),
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    redact: ['*.password', '*.refreshToken', '*.refresh_token'],
  };
}
