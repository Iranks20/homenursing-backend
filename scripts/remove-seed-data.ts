import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_USER_EMAILS = [
  'receptionist@physio.com',
  'receptionist2@physio.com',
  'biller@physio.com',
  'neurologist@physio.com',
  'orthopedist@physio.com',
  'physiospecialist@physio.com',
  'physiotherapist@physio.com',
  'occupationaltherapist@physio.com',
  'speechtherapist@physio.com',
  'nurse1@physio.com',
  'nurse2@physio.com',
  'lab@physio.com',
] as const;

const SEED_PATIENT_EMAILS = [
  'alice.thompson@example.com',
  'robert.martinez@example.com',
  'mary.davis@example.com',
  'john.smith@example.com',
] as const;

async function main() {
  const confirm =
    process.env.CONFIRM_REMOVE_SEED === 'yes' || process.argv.includes('--confirm');
  if (!confirm) {
    console.log('This script removes only seed/demo users and patients (see SEED_USER_EMAILS and SEED_PATIENT_EMAILS in the script).');
    console.log('To run it, pass: --confirm');
    console.log('Example: npm run script:remove-seed-data -- --confirm');
    process.exit(1);
  }

  console.log('Removing seed data only (real users and patients are kept)...\n');

  const seedUsers = await prisma.user.findMany({
    where: { email: { in: [...SEED_USER_EMAILS] } },
    select: { id: true, email: true },
  });

  const seedPatients = await prisma.patient.findMany({
    where: { email: { in: [...SEED_PATIENT_EMAILS] } },
    select: { id: true, email: true, name: true },
  });

  const seedUserIds = new Set(seedUsers.map((u) => u.id));
  const seedPatientIds = new Set(seedPatients.map((p) => p.id));

  if (seedUsers.length === 0 && seedPatients.length === 0) {
    console.log('No seed users or seed patients found. Nothing to remove.');
    return;
  }

  console.log(`Found ${seedUsers.length} seed user(s) and ${seedPatients.length} seed patient(s) to remove.\n`);

  const unassignSpecialist = await prisma.patient.updateMany({
    where: { assignedSpecialistId: { in: [...seedUserIds] } },
    data: { assignedSpecialistId: null },
  });
  const unassignTherapist = await prisma.patient.updateMany({
    where: { assignedTherapistId: { in: [...seedUserIds] } },
    data: { assignedTherapistId: null },
  });
  const unassignNurse = await prisma.patient.updateMany({
    where: { assignedNurseId: { in: [...seedUserIds] } },
    data: { assignedNurseId: null },
  });
  if (unassignSpecialist.count + unassignTherapist.count + unassignNurse.count > 0) {
    console.log('Unassigned patients from seed users (so seed users can be deleted).');
  }

  // 2. Delete seed patients (DB cascades will remove their appointments, invoices, health records, etc.)
  const deletedPatients = await prisma.patient.deleteMany({
    where: { id: { in: [...seedPatientIds] } },
  });
  console.log(`Deleted ${deletedPatients.count} seed patient(s).`);

  // 3. Reassign records that reference seed users (so we can delete seed users without FK errors)
  const fallbackUser = await prisma.user.findFirst({
    where: { email: { notIn: [...SEED_USER_EMAILS] } },
    select: { id: true, name: true },
  });
  if (fallbackUser) {
    const hr = await prisma.healthRecordUpdate.updateMany({
      where: { updatedBy: { in: [...seedUserIds] } },
      data: { updatedBy: fallbackUser.id, updatedByName: fallbackUser.name },
    });
    if (hr.count > 0) console.log(`Reassigned ${hr.count} health record update(s) to ${fallbackUser.name} (so seed users can be deleted).`);
  }

  // 4. Delete seed users
  const deletedUsers = await prisma.user.deleteMany({
    where: { email: { in: [...SEED_USER_EMAILS] } },
  });
  console.log(`Deleted ${deletedUsers.count} seed user(s).`);

  console.log('\nSeed data removal complete. Your real users and patients are unchanged.');
}

main()
  .catch((e) => {
    console.error('Error removing seed data:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
