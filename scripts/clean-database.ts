import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TABLES = [
  'training_exam_answers',
  'training_exam_attempts',
  'training_exam_certificates',
  'training_exam_questions',
  'training_exams',
  'audit_logs',
  'feedback',
  'payments',
  'invoices',
  'referrals',
  'lab_results',
  'lab_samples',
  'investigation_requests',
  'notifications',
  'health_record_updates',
  'appointments',
  'availability_slots',
  'case_events',
  'patient_cases',
  'progress_records',
  'medical_records',
  'nurse_schedules',
  'patients',
  'user_sessions',
  'refresh_tokens',
  'users',
  'therapists',
  'specialists',
  'nurses',
  'services',
  'specializations',
  'system_config',
];

async function main() {
  const confirm = process.env.CONFIRM_CLEAN_DB === 'yes' || process.env.CONFIRM_CLEAN_DB === 'true';
  if (!confirm) {
    console.error(
      '❌ Refusing to run without confirmation. Set CONFIRM_CLEAN_DB=yes to confirm you want to wipe all data.'
    );
    console.error('   Example: CONFIRM_CLEAN_DB=yes npm run script:clean-database');
    process.exit(1);
  }

  console.log('⚠️  Cleaning database (all application tables will be emptied)...\n');

  const quoted = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`
  );

  console.log('✅ Database cleaned. All data removed from application tables.\n');

  const seedAfter = process.env.SEED_AFTER_CLEAN === 'yes' || process.env.SEED_AFTER_CLEAN === 'true';
  if (seedAfter) {
    console.log('Creating admin user only...\n');
    const { execSync } = await import('child_process');
    execSync('npm run db:seed:admin-only', { stdio: 'inherit', cwd: process.cwd() });
    console.log('\n✅ Done. Log in with username: admin, password: Admin@123');
  } else {
    console.log('To create only the admin user, run:');
    console.log('  CONFIRM_CLEAN_DB=yes SEED_AFTER_CLEAN=yes npm run script:clean-database');
    console.log('Or create admin without cleaning: npm run db:seed:admin-only');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
