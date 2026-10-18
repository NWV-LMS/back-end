import * as crypto from 'crypto';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

// Format: enc:v1:<base64(iv)>:<base64(tag)>:<base64(ciphertext)>
const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) return null;
  const trimmed = raw.trim();
  // Prefer base64-encoded 32 bytes, but accept raw 32+ chars as fallback.
  try {
    const b = Buffer.from(trimmed, 'base64');
    if (b.length === 32) return b;
  } catch {
    // ignore
  }
  if (trimmed.length >= 32) {
    // Derive a stable 32-byte key from the string.
    return crypto.createHash('sha256').update(trimmed).digest();
  }
  return null;
}

function requireKey(): Buffer {
  const key = getKey();
  if (!key) {
    throw new ServiceUnavailableException(
      'Provider credential encryption is not configured',
    );
  }
  return key;
}

export function assertSecretEncryptionConfigured(): void {
  requireKey();
}

export function encryptSecret(plain: string): string {
  // Inputs are plaintext provider credentials. Accepting client ciphertext can
  // create unusable double-encrypted values or bypass credential replacement.
  if (plain.startsWith('enc:')) {
    throw new BadRequestException('Provider credentials must be plaintext');
  }
  const key = requireKey();

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return (
    PREFIX +
    iv.toString('base64') +
    ':' +
    tag.toString('base64') +
    ':' +
    ciphertext.toString('base64')
  );
}

/** Omitted/null fields keep the stored value; an empty string clears it. */
export function encryptSecretUpdate(
  plain: string | null | undefined,
): string | null | undefined {
  if (plain == null) return undefined;
  if (plain === '') return null;
  return encryptSecret(plain);
}

export function decryptSecret(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  // Keep legacy plaintext readable until the explicit migration is run.
  if (!stored.startsWith(PREFIX)) {
    return stored.startsWith('enc:') ? null : stored;
  }

  const key = getKey();
  if (!key) {
    // Can't decrypt without key.
    return null;
  }

  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, ctB64] = parts;

  try {
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(ct),
      decipher.final(),
    ]).toString('utf8');
    return plain;
  } catch {
    return null;
  }
}
