/**
 * Creates only the admin user (username: admin, password: Admin@123).
 * Use after cleaning the DB so you have a single account to log in; other users can be created in the app.
 */
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
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
      phone: null,
      department: 'Administration',
      employeeId: 'EMP-ADMIN-001',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Admin user ready. Username: admin, Password: Admin@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
