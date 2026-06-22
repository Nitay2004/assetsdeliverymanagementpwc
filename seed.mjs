import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const rawUrl = process.env.DIRECT_URL;
const connectionString = rawUrl.replace(
  /(postgresql:\/\/[^:]+:)([^@]+)@/,
  (_, prefix, pwd) => `${prefix}${encodeURIComponent(pwd)}@`,
);
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'admin@devit.com';
  const password = 'password123';
  
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Admin User',
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Created user: ${user.email}`);
  console.log(`🔑 Password: ${password}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
