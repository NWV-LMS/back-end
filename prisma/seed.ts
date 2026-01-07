// import { PrismaClient } from '@prisma/client';
// import * as dotenv from 'dotenv';
// dotenv.config();
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
// import { UserRole } from 'generated/prisma/enums'

// const prisma = new PrismaClient();

// async function main() {
//   const email = process.env.SUPER_ADMIN_EMAIL;
//   const password = process.env.SUPER_ADMIN_PASSWORD;

//   if (!email || !password) {
//     throw new Error('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is missing');
//   }

//   const existing = await prisma.user.findUnique({
//     where: { email },
//   });

//   if (existing) {
//     console.log('SUPER_ADMIN already exists');
//     return;
//   }

//   const hashed = await bcrypt.hash(password, 10);

//   await prisma.user.create({
//     data: {
//       email,
//       password: hashed,
//       role: UserRole.SUPER_ADMIN,
//       organization_id: null,
//     },
//   });

//   console.log('SUPER_ADMIN created successfully');
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });


const prisma = new PrismaClient();

async function main() {
  const orgId = uuidv4();
  
  // Organization
  const org = await prisma.organization.create({
    data: {
      id: orgId,
      name: 'Platform Super Admin',
      email: 'platform@admin.com',
      phone: '+998901234567',
      address: 'Platform HQ',
      status: 'ACTIVE',
      industry: 'TECHNOLOGY',
      subscription_plan: 'ENTERPRISE',
    },
  });

  // User (password hashed)
  const hashedPassword = await bcrypt.hash('StrongPassword123', 10);
  
  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: 'admin@platform.com',
      phone: '+998901234567',
      first_name: 'Admin',
      last_name: 'Platform',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      organization_id: orgId,
    },
  });

  console.log('✅ Organization:', org.id);
  console.log('✅ User:', user.email);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());