import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
import * as bcrypt from 'bcrypt';
import { UserRole } from 'generated/prisma/enums'

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is missing');
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log('SUPER_ADMIN already exists');
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
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
