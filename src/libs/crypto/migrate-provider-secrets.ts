import { PrismaClient } from '@prisma/client';
import { assertSecretEncryptionConfigured, encryptSecret } from './secrets';

const TOKEN_FIELDS = ['telegram_bot_token', 'whatsapp_cloud_token'] as const;
const BATCH_SIZE = 100;

/** One-time, bounded migration; concurrent credential changes are not overwritten. */
export async function encryptLegacyProviderSecrets(
  database: Pick<PrismaClient, 'organization'>,
): Promise<{
  scanned: number;
  encrypted: number;
  changedConcurrently: number;
}> {
  assertSecretEncryptionConfigured();
  let cursor: string | undefined;
  let scanned = 0;
  let encrypted = 0;
  let changedConcurrently = 0;

  for (;;) {
    const organizations = await database.organization.findMany({
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        telegram_bot_token: true,
        whatsapp_cloud_token: true,
      },
    });
    if (organizations.length === 0) break;

    for (const organization of organizations) {
      scanned++;
      for (const field of TOKEN_FIELDS) {
        const stored = organization[field];
        if (!stored || stored.startsWith('enc:')) continue;
        const result = await database.organization.updateMany({
          where: { id: organization.id, [field]: stored },
          data: { [field]: encryptSecret(stored) },
        });
        encrypted += result.count;
        changedConcurrently += result.count === 0 ? 1 : 0;
      }
    }
    cursor = organizations[organizations.length - 1].id;
  }

  return { scanned, encrypted, changedConcurrently };
}
