import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { PrismaClient, UserRole } from '@prisma/client'
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is missing');
  }

  const existing = await prisma.user.findUnique({
    where: { phone: email },
  });

  if (existing) {
    console.log('SUPER_ADMIN already exists');
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email: email,
      phone: email,
      full_name: 'Platform Super Admin',
      password: hashed,
      role: UserRole.SUPER_ADMIN,
      organization_id: null,
    },
  });

  console.log('SUPER_ADMIN created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });