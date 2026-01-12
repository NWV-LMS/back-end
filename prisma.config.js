require('dotenv/config');
const { defineConfig, env } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: "npx ts-node prisma/seed.ts",

  },
  datasource: {
    url: env('DATABASE_URL') || process.env.DATABASE_URL,
  },
});
