import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(nodeScrypt);
export const randomToken = () => randomBytes(32).toString('base64url');
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const safeEqual = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
export const after = (seconds: number) => new Date(Date.now() + seconds * 1000);
export const GENERIC_EMAIL_RESPONSE = {
  message: 'If eligible, check your email for the next step.',
};

// scrypt handles all UTF-8 bytes (bcrypt silently truncates after 72 bytes).
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function checkPassword(password: string, stored?: string | null) {
  const parts = stored?.split(':');
  const valid =
    parts?.length === 3 &&
    parts[0] === 'scrypt' &&
    /^[a-f0-9]{128}$/.test(parts[2]);
  const salt = valid ? parts[1] : 'invalid-account-salt';
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return Boolean(valid && timingSafeEqual(hash, Buffer.from(parts[2], 'hex')));
}
