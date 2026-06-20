import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('Admin@123', 8);
  const trainerPassword = await bcrypt.hash('Trainer@123', 8);
  const nursePassword = await bcrypt.hash('Nurse@123', 8);
  const supervisorPassword = await bcrypt.hash('Supervisor@123', 8);

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
      department: 'Administration',
      employeeId: 'EMP-ADMIN-001',
      isActive: true,
      isVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'trainer@homenursing.com' },
    update: {
      username: 'trainer',
      password: trainerPassword,
      name: 'Training Coordinator',
      role: UserRole.TRAINER,
      isActive: true,
      isVerified: true,
    },
    create: {
      username: 'trainer',
      email: 'trainer@homenursing.com',
      name: 'Training Coordinator',
      password: trainerPassword,
      role: UserRole.TRAINER,
      department: 'Training',
      employeeId: 'EMP-TRAINER-001',
      isActive: true,
      isVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'nurse@homenursing.com' },
    update: {
      username: 'nurse',
      password: nursePassword,
      name: 'Sample Nurse',
      role: UserRole.NURSE,
      isActive: true,
      isVerified: true,
    },
    create: {
      username: 'nurse',
      email: 'nurse@homenursing.com',
      name: 'Sample Nurse',
      password: nursePassword,
      role: UserRole.NURSE,
      department: 'Nursing',
      employeeId: 'EMP-NURSE-001',
      isActive: true,
      isVerified: true,
    },
  });

  await prisma.nurse.upsert({
    where: { email: 'nurse@homenursing.com' },
    update: {
      name: 'Sample Nurse',
      status: 'ACTIVE',
    },
    create: {
      name: 'Sample Nurse',
      email: 'nurse@homenursing.com',
      phone: '+256700000001',
      licenseNumber: 'NRS-001',
      specialization: 'General Nursing',
      experience: 3,
      status: 'ACTIVE',
      hireDate: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email: 'supervisor@homenursing.com' },
    update: {
      username: 'supervisor',
      password: supervisorPassword,
      name: 'Field Supervisor',
      role: UserRole.SUPERVISOR,
      isActive: true,
      isVerified: true,
    },
    create: {
      username: 'supervisor',
      email: 'supervisor@homenursing.com',
      name: 'Field Supervisor',
      password: supervisorPassword,
      role: UserRole.SUPERVISOR,
      department: 'Supervision',
      employeeId: 'EMP-SUPERVISOR-001',
      isActive: true,
      isVerified: true,
    },
  });

  console.log('✅ Staff ready:');
  console.log('   admin / Admin@123');
  console.log('   trainer / Trainer@123');
  console.log('   nurse / Nurse@123');
  console.log('   supervisor / Supervisor@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
