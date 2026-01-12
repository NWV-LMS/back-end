import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

import { UserRole } from '../generated/prisma/enums';
import { PrismaClient } from '@prisma/client/default'
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

// async function main() {
//   const orgId = uuidv4();

//   // Organization
//   const org = await prisma.organization.create({
//     data: {
//       id: orgId,
//       name: 'Platform Super Admin',
//       email: 'platform@admin.com',
//       phone: '+998901234567',
//       address: 'Platform HQ',
//       status: 'ACTIVE',
//       industry: 'TECHNOLOGY',
//       subscription_plan: 'ENTERPRISE',
//     },
//   });

//   // User (password hashed)
//   const hashedPassword = await bcrypt.hash('StrongPassword123', 10);

//   const user = await prisma.user.create({
//     data: {
//       id: uuidv4(),
//       email: 'admin@platform.com',
//       phone: '+998901234567',
//       first_name: 'Admin',
//       last_name: 'Platform',
//       password: hashedPassword,
//       role: 'SUPER_ADMIN',
//       status: 'ACTIVE',
//       organization_id: orgId,
//     },
//   });

//   console.log('✅ Organization:', org.id);
//   console.log('✅ User:', user.email);
// }

// main()
//   .catch(e => console.error(e))
//   .finally(() => prisma.$disconnect());
