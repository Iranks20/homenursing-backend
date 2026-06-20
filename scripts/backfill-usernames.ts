import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function sanitizeUsername(prefix: string): string {
  return prefix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 50) || 'user';
}

async function main() {
  console.log('Listing current users...\n');
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true, role: true, username: true },
  });

  if (users.length === 0) {
    console.log('No users in the system. Creating admin user...');
  } else {
    console.log('Current users:');
    users.forEach((u) => {
      console.log(`  - ${u.email} | name: ${u.name} | role: ${u.role} | username: ${u.username ?? '(null)'}`);
    });
    console.log('');
  }

  const withoutUsername = users.filter((u) => u.username == null || u.username === '');
  if (withoutUsername.length > 0) {
    console.log(`Backfilling username for ${withoutUsername.length} user(s)...`);
    const used = new Set(users.map((u) => u.username).filter(Boolean) as string[]);

    for (const user of withoutUsername) {
      let base = sanitizeUsername(user.email.split('@')[0] || user.name || 'user');
      let username = base;
      let n = 1;
      while (used.has(username)) {
        username = `${base}${n}`;
        n++;
      }
      used.add(username);
      await prisma.user.update({
        where: { id: user.id },
        data: { username },
      });
      console.log(`  Updated ${user.email} -> username: ${username}`);
    }
    console.log('');
  }

  // 2) Ensure admin user exists (username: admin, password: Admin@123)
  const adminPassword = await bcrypt.hash('Admin@123', 8);
  await prisma.user.upsert({
    where: { email: 'admin@physio.com' },
    update: {
      username: 'admin',
      password: adminPassword,
      name: 'System Administrator',
      role: UserRole.ADMIN,
      isActive: true,
      isVerified: true,
    },
    create: {
      username: 'admin',
      email: 'admin@physio.com',
      name: 'System Administrator',
      password: adminPassword,
      role: UserRole.ADMIN,
      isActive: true,
      isVerified: true,
    },
  });
  console.log('Admin user ensured:');
  console.log('  Username: admin');
  console.log('  Password: Admin@123');
  console.log('  Email: admin@physio.com');
  console.log('');

  // 3) List all users again
  const updated = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { email: true, name: true, role: true, username: true },
  });
  console.log('All users after backfill:');
  updated.forEach((u) => {
    console.log(`  - username: ${u.username ?? '(null)'} | ${u.email} | ${u.name} | ${u.role}`);
  });
  console.log('\nDone. You can log in with username "admin" and password "Admin@123".');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
