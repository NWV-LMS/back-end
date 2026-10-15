import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { encryptLegacyProviderSecrets } from '../src/libs/crypto/migrate-provider-secrets';

// Keep the same local override order as the application. Injected values win.
dotenv.config({
  path: [
    `.env.${process.env.NODE_ENV ?? 'development'}.local`,
    '.env.local',
    `.env.${process.env.NODE_ENV ?? 'development'}`,
    '.env',
  ],
  quiet: true,
});

async function main(): Promise<void> {
  const database = new PrismaClient();
  try {
    const counts = await encryptLegacyProviderSecrets(database);
    console.log(JSON.stringify(counts));
  } finally {
    await database.$disconnect();
  }
}

main().catch(() => {
  // Prisma errors can include query inputs. Never dump credentials in CLI logs.
  console.error(
    'Provider credential migration failed; check DATABASE_URL and APP_ENCRYPTION_KEY configuration',
  );
  process.exitCode = 1;
});
