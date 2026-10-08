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
  // No default password in the repo: set SEED_ADMIN_PASSWORD in .env before
  // running `node seed.mjs`. Existing admins are untouched (upsert update:{}).
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    console.error('SEED_ADMIN_PASSWORD is not set. Add it to .env and retry.');
    process.exit(1);
  }

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

  console.log(`✅ Admin user ready: ${user.email}`);
  console.log('🔑 Password taken from SEED_ADMIN_PASSWORD (not stored in the repo)');
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
