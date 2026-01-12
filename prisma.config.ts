import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',  // Adjust if your migrations are stored elsewhere
    // seed: 'tsx prisma/seed.ts',  // Uncomment and customize if you have a seed script
  },
  datasource: {
    url: env('DATABASE_URL'),  // This is required for migrations
    // shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),  // Optional, add if needed for shadow DB
  },
});