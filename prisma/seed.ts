import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { PrismaClient, UserRole, OrganizationStatus } from '@prisma/client'
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
  const orgName =
    process.env.SUPER_ADMIN_ORG_NAME || 'Education Center Platform';
  const orgEmail = process.env.SUPER_ADMIN_ORG_EMAIL || email;
  const orgPhone = process.env.SUPER_ADMIN_ORG_PHONE || email;

  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is missing');
  }

  const existing = await prisma.user.findFirst({
    where: { email },
  });

  if (existing) {
    console.log('SUPER_ADMIN already exists');
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: orgName,
        email: orgEmail,
        phone: orgPhone,
        status: OrganizationStatus.ACTIVE,
      },
    });

    await tx.user.create({
      data: {
        email,
        phone: email,
        full_name: 'Platform Super Admin',
        password: hashed,
        role: UserRole.SUPER_ADMIN,
        organization_id: organization.id,
      },
    });
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
