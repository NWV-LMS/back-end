import crypto from 'crypto';

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

export function encryptSecret(plain: string): string {
  const key = getKey();
  if (!key) return plain; // non-breaking fallback; set APP_ENCRYPTION_KEY in prod

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
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

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored;

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
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    return plain;
  } catch {
    return null;
  }
}

