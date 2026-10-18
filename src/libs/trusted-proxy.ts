import { Express } from 'express';

export function configureTrustedProxy(
  app: Pick<Express, 'set'>,
  configured = process.env.TRUST_PROXY,
): void {
  const value = configured?.trim();
  if (!value || value === 'false' || value === '0') {
    app.set('trust proxy', false);
    return;
  }
  if (value === 'true' || value === '*') {
    throw new Error(
      'TRUST_PROXY must specify trusted addresses or a hop count',
    );
  }
  // A hop count is safe only when every route to the API has that many trusted
  // proxies and direct client access to the backend is blocked by deployment.
  app.set(
    'trust proxy',
    /^\d+$/.test(value)
      ? Number(value)
      : value.split(',').map((address) => address.trim()),
  );
}
