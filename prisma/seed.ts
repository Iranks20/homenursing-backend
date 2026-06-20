import { PrismaClient, UserRole, PatientStatus, NurseStatus, SpecialistStatus, AppointmentStatus, RecordRole, RecordType, SpecialistSpecialization, SpecialistType, TherapistSpecialization, PatientStage } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Prevent accidental seed on production (creates test users and demo data)
  const isProduction = process.env.NODE_ENV === 'production';
  const allowInProduction = process.env.ALLOW_SEED_IN_PRODUCTION === 'yes' || process.env.ALLOW_SEED_IN_PRODUCTION === '1';
  if (isProduction && !allowInProduction) {
    console.error('❌ Seed is disabled in production to avoid creating test users and demo data.');
    console.error('   If you really need to add only the Consultation service or run seed, set:');
    console.error('   ALLOW_SEED_IN_PRODUCTION=yes');
    console.error('   To remove previously seeded test data only, run:');
    console.error('   CONFIRM_REMOVE_SEED=yes npm run script:remove-seed-data');
    process.exit(1);
  }

  console.log('🌱 Starting database seed for Physiotherapy Center Management System...');

  // Hash password function
  // Reduced rounds from 12 to 8 for t3.micro memory constraints (1GB RAM)
  // 8 rounds is still secure but uses ~75% less memory during hashing
  const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, 8);
  };

  // Clear existing data (optional - uncomment if needed)
  // await prisma.patient.deleteMany();
  // await prisma.nurse.deleteMany();
  // await prisma.specialist.deleteMany();
  // await prisma.service.deleteMany();
  // await prisma.user.deleteMany();

  // ============================================
  // CREATE USERS WITH NEW 5-ROLE STRUCTURE
  // ============================================

  // 1. Create Admin User
  console.log('Creating admin user...');
  const adminPassword = await hashPassword('Admin@123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@physio.com' },
    update: { username: 'admin' },
    create: {
      username: 'admin',
      email: 'admin@physio.com',
      name: 'System Administrator',
      password: adminPassword,
      role: UserRole.ADMIN,
      phone: '+1234567890',
      department: 'Administration',
      employeeId: 'EMP-ADMIN-001',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Admin user created:', admin.email, '(username: admin)');

  // 2. Create Receptionist Users
  console.log('Creating receptionist users...');
  const receptionist1Password = await hashPassword('Reception@123');
  const receptionist1 = await prisma.user.upsert({
    where: { email: 'receptionist@physio.com' },
    update: { username: 'receptionist1' },
    create: {
      username: 'receptionist1',
      email: 'receptionist@physio.com',
      name: 'Emma Watson',
      password: receptionist1Password,
      role: UserRole.RECEPTIONIST,
      phone: '+1234567891',
      department: 'Reception',
      employeeId: 'EMP-REC-001',
      isActive: true,
      isVerified: true,
    },
  });

  const receptionist2Password = await hashPassword('Reception@123');
  const receptionist2 = await prisma.user.upsert({
    where: { email: 'receptionist2@physio.com' },
    update: { username: 'receptionist2' },
    create: {
      username: 'receptionist2',
      email: 'receptionist2@physio.com',
      name: 'David Lee',
      password: receptionist2Password,
      role: UserRole.RECEPTIONIST,
      phone: '+1234567892',
      department: 'Reception',
      employeeId: 'EMP-REC-002',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Receptionist users created');

  // 2.5. Create Biller User
  console.log('Creating biller user...');
  const billerPassword = await hashPassword('Biller@123');
  const biller = await prisma.user.upsert({
    where: { email: 'biller@physio.com' },
    update: { username: 'biller' },
    create: {
      username: 'biller',
      email: 'biller@physio.com',
      name: 'Finance Manager',
      password: billerPassword,
      role: UserRole.BILLER,
      phone: '+1234567892',
      department: 'Finance',
      employeeId: 'EMP-BILL-001',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Biller user created:', biller.email, '(username: biller)');

  // 3. Create Specialist Users (formerly Doctors, with specializations)
  console.log('Creating specialist users...');
  
  // Neurologist Specialist
  const neurologistPassword = await hashPassword('Specialist@123');
  const neurologist = await prisma.user.upsert({
    where: { email: 'neurologist@physio.com' },
    update: { username: 'neurologist' },
    create: {
      username: 'neurologist',
      email: 'neurologist@physio.com',
      name: 'Dr. Sarah Johnson',
      password: neurologistPassword,
      role: UserRole.SPECIALIST,
      specialistSpecialization: SpecialistSpecialization.NEUROLOGIST,
      phone: '+1234567893',
      department: 'Neurology',
      employeeId: 'EMP-SPEC-NEU-001',
      licenseNumber: 'MD-NEU-12345',
      isActive: true,
      isVerified: true,
    },
  });

  const orthopedistPassword = await hashPassword('Specialist@123');
  const orthopedist = await prisma.user.upsert({
    where: { email: 'orthopedist@physio.com' },
    update: { username: 'orthopedist' },
    create: {
      username: 'orthopedist',
      email: 'orthopedist@physio.com',
      name: 'Dr. Michael Chen',
      password: orthopedistPassword,
      role: UserRole.SPECIALIST,
      specialistSpecialization: SpecialistSpecialization.ORTHOPEDIST,
      phone: '+1234567894',
      department: 'Orthopedics',
      employeeId: 'EMP-SPEC-ORT-001',
      licenseNumber: 'MD-ORT-12345',
      isActive: true,
      isVerified: true,
    },
  });

  const physioSpecialistPassword = await hashPassword('Specialist@123');
  const physioSpecialist = await prisma.user.upsert({
    where: { email: 'physiospecialist@physio.com' },
    update: { username: 'physiospecialist' },
    create: {
      username: 'physiospecialist',
      email: 'physiospecialist@physio.com',
      name: 'Dr. James Wilson',
      password: physioSpecialistPassword,
      role: UserRole.SPECIALIST,
      specialistSpecialization: SpecialistSpecialization.PHYSIOTHERAPIST,
      phone: '+1234567895',
      department: 'Physical Therapy',
      employeeId: 'EMP-SPEC-PT-001',
      licenseNumber: 'MD-PT-12345',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Specialist users created');

  // 4. Create Therapist Users (patients are referred to therapists after specialist review)
  console.log('Creating therapist users...');
  
  // Physiotherapy Therapist
  const physioTherapistPassword = await hashPassword('Therapist@123');
  const physioTherapist = await prisma.user.upsert({
    where: { email: 'physiotherapist@physio.com' },
    update: { username: 'physiotherapist' },
    create: {
      username: 'physiotherapist',
      email: 'physiotherapist@physio.com',
      name: 'Lisa Anderson',
      password: physioTherapistPassword,
      role: UserRole.THERAPIST,
      therapistSpecialization: TherapistSpecialization.PHYSIOTHERAPY,
      phone: '+1234567896',
      department: 'Physical Therapy',
      employeeId: 'EMP-THER-PT-001',
      licenseNumber: 'PT-12345',
      isActive: true,
      isVerified: true,
    },
  });

  const occupationalTherapistPassword = await hashPassword('Therapist@123');
  const occupationalTherapist = await prisma.user.upsert({
    where: { email: 'occupationaltherapist@physio.com' },
    update: { username: 'occupationaltherapist' },
    create: {
      username: 'occupationaltherapist',
      email: 'occupationaltherapist@physio.com',
      name: 'Maria Garcia',
      password: occupationalTherapistPassword,
      role: UserRole.THERAPIST,
      therapistSpecialization: TherapistSpecialization.OCCUPATIONAL_THERAPY,
      phone: '+1234567897',
      department: 'Occupational Therapy',
      employeeId: 'EMP-THER-OT-001',
      licenseNumber: 'OT-12345',
      isActive: true,
      isVerified: true,
    },
  });

  const speechTherapistPassword = await hashPassword('Therapist@123');
  const speechTherapist = await prisma.user.upsert({
    where: { email: 'speechtherapist@physio.com' },
    update: { username: 'speechtherapist' },
    create: {
      username: 'speechtherapist',
      email: 'speechtherapist@physio.com',
      name: 'Emily Williams',
      password: speechTherapistPassword,
      role: UserRole.THERAPIST,
      therapistSpecialization: TherapistSpecialization.SPEECH_THERAPY,
      phone: '+1234567898',
      department: 'Speech Therapy',
      employeeId: 'EMP-THER-ST-001',
      licenseNumber: 'ST-12345',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Therapist users created');

  // 5. Create Nurse Users
  console.log('Creating nurse users...');
  const nurse1Password = await hashPassword('Nurse@123');
  const nurse1 = await prisma.user.upsert({
    where: { email: 'nurse1@physio.com' },
    update: { username: 'nurse1' },
    create: {
      username: 'nurse1',
      email: 'nurse1@physio.com',
      name: 'Jennifer Brown',
      password: nurse1Password,
      role: UserRole.NURSE,
      phone: '+1234567899',
      department: 'Home Care',
      employeeId: 'EMP-NUR-001',
      licenseNumber: 'RN-12345',
      isActive: true,
      isVerified: true,
    },
  });

  const nurse2Password = await hashPassword('Nurse@123');
  const nurse2 = await prisma.user.upsert({
    where: { email: 'nurse2@physio.com' },
    update: { username: 'nurse2' },
    create: {
      username: 'nurse2',
      email: 'nurse2@physio.com',
      name: 'Robert Taylor',
      password: nurse2Password,
      role: UserRole.NURSE,
      phone: '+1234567900',
      department: 'Home Care',
      employeeId: 'EMP-NUR-002',
      licenseNumber: 'RN-12346',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Nurse users created');

  // 2.8. Create Lab Attendant User
  console.log('Creating lab attendant user...');
  const labAttendantPassword = await hashPassword('Lab@123');
  const labAttendant = await prisma.user.upsert({
    where: { email: 'lab@physio.com' },
    update: { username: 'labattendant' },
    create: {
      username: 'labattendant',
      email: 'lab@physio.com',
      name: 'Lab Attendant',
      password: labAttendantPassword,
      role: UserRole.LAB_ATTENDANT,
      phone: '+1234567905',
      department: 'Laboratory',
      employeeId: 'EMP-LAB-001',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Lab attendant user created:', labAttendant.email, '(username: labattendant)');

  // ============================================
  // CREATE PATIENTS WITH WORKFLOW ASSIGNMENTS
  // ============================================
  console.log('Creating patients...');
  const patient1 = await prisma.patient.upsert({
    where: { email: 'alice.thompson@example.com' },
    update: {},
    create: {
      name: 'Alice Thompson',
      email: 'alice.thompson@example.com',
      phone: '+1234567901',
      dateOfBirth: new Date('1950-05-15'),
      address: '123 Main Street, City, State 12345',
      condition: 'Stroke Recovery',
      status: PatientStatus.ACTIVE,
      currentStage: PatientStage.SPECIALIST_REVIEW,
      assignedSpecialistId: neurologist.id,
      admissionDate: new Date('2024-01-10'),
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { email: 'robert.martinez@example.com' },
    update: {},
    create: {
      name: 'Robert Martinez',
      email: 'robert.martinez@example.com',
      phone: '+1234567902',
      dateOfBirth: new Date('1945-08-20'),
      address: '456 Oak Avenue, City, State 12346',
      condition: 'Hip Replacement Recovery',
      status: PatientStatus.ACTIVE,
      currentStage: PatientStage.THERAPIST_TREATMENT,
      assignedSpecialistId: orthopedist.id,
      assignedTherapistId: occupationalTherapist.id,
      admissionDate: new Date('2024-01-15'),
    },
  });

  const patient3 = await prisma.patient.upsert({
    where: { email: 'mary.davis@example.com' },
    update: {},
    create: {
      name: 'Mary Davis',
      email: 'mary.davis@example.com',
      phone: '+1234567903',
      dateOfBirth: new Date('1960-12-10'),
      address: '789 Pine Road, City, State 12347',
      condition: 'Arthritis Management',
      status: PatientStatus.ACTIVE,
      currentStage: PatientStage.NEW,
      admissionDate: new Date('2024-01-20'),
    },
  });

  const patient4 = await prisma.patient.upsert({
    where: { email: 'john.smith@example.com' },
    update: {},
    create: {
      name: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+1234567904',
      dateOfBirth: new Date('1955-03-25'),
      address: '321 Elm Street, City, State 12348',
      condition: 'Home Care - Post Surgery',
      status: PatientStatus.ACTIVE,
      currentStage: PatientStage.NEW,
      assignedNurseId: nurse1.id,
      admissionDate: new Date('2024-01-25'),
    },
  });
  console.log('✅ Patients created');

  // ============================================
  // CREATE SERVICES (Physiotherapy Focused)
  // ============================================
  console.log('Creating services...');
  const service1 = await prisma.service.upsert({
    where: { id: 'service-1' },
    update: {},
    create: {
      id: 'service-1',
      name: 'Physical Therapy Assessment',
      description: 'Comprehensive physical therapy assessment and evaluation',
      category: 'ASSESSMENT',
      price: 200.0,
      duration: 60,
      features: ['Initial Assessment', 'Range of Motion Testing', 'Strength Evaluation', 'Treatment Plan'],
      isActive: true,
    },
  });

  const service2 = await prisma.service.upsert({
    where: { id: 'service-2' },
    update: {},
    create: {
      id: 'service-2',
      name: 'Physiotherapy Treatment',
      description: 'Personalized physiotherapy treatment sessions',
      category: 'PHYSIOTHERAPY',
      price: 180.0,
      duration: 60,
      features: ['Exercise Therapy', 'Manual Therapy', 'Pain Management', 'Mobility Training'],
      isActive: true,
    },
  });

  const service3 = await prisma.service.upsert({
    where: { id: 'service-3' },
    update: {},
    create: {
      id: 'service-3',
      name: 'Neurological Rehabilitation',
      description: 'Specialized rehabilitation for neurological conditions',
      category: 'NEUROLOGY',
      price: 220.0,
      duration: 90,
      features: ['Neurological Assessment', 'Balance Training', 'Coordination Exercises', 'Cognitive Therapy'],
      isActive: true,
    },
  });

  const service4 = await prisma.service.upsert({
    where: { id: 'service-4' },
    update: {},
    create: {
      id: 'service-4',
      name: 'Home Care Nursing',
      description: 'Professional nursing care at home',
      category: 'HOME_CARE',
      price: 150.0,
      duration: 60,
      features: ['Medication Management', 'Wound Care', 'Vital Signs Monitoring', 'Health Assessment'],
      isActive: true,
    },
  });

  // Consultation fee line item (amount set per invoice from consultant's consultationFee)
  await prisma.service.upsert({
    where: { id: 'service-consultation' },
    update: {},
    create: {
      id: 'service-consultation',
      name: 'Consultation',
      description: 'Consultation fee for assigned specialist or therapist',
      category: 'ASSESSMENT',
      price: 0,
      duration: 0,
      features: ['Consultation'],
      isActive: true,
    },
  });
  console.log('✅ Services created');

  // ============================================
  // CREATE APPOINTMENTS
  // ============================================
  console.log('Creating appointments...');
  const appointment1 = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      serviceId: service3.id,
      date: new Date('2024-02-15'),
      time: '10:00',
      duration: 90,
      status: AppointmentStatus.SCHEDULED,
      notes: 'Neurological rehabilitation session',
    },
  });

  const appointment2 = await prisma.appointment.create({
    data: {
      patientId: patient2.id,
      serviceId: service2.id,
      date: new Date('2024-02-16'),
      time: '14:00',
      duration: 60,
      status: AppointmentStatus.SCHEDULED,
      notes: 'Physical therapy treatment',
    },
  });
  console.log('✅ Appointments created');

  // ============================================
  // CREATE HEALTH RECORDS
  // ============================================
  console.log('Creating health record updates...');
  await prisma.healthRecordUpdate.create({
    data: {
      patientId: patient1.id,
      updatedBy: nurse1.id,
      updatedByName: nurse1.name,
      updatedByRole: RecordRole.NURSE,
      recordType: RecordType.VITAL,
      data: {
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 98.6,
        weight: 165,
      },
      location: 'Home',
      notes: 'Regular vital signs check',
      verified: true,
      verifiedBy: neurologist.id, // Specialist verifies nurse's health record
      verifiedAt: new Date(),
    },
  });
  console.log('✅ Health record updates created');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n📊 Seed Summary:');
  console.log('================');
  const userCount = await prisma.user.count();
  const patientCount = await prisma.patient.count();
  const serviceCount = await prisma.service.count();
  const appointmentCount = await prisma.appointment.count();

  console.log(`Users: ${userCount}`);
  console.log(`Patients: ${patientCount}`);
  console.log(`Services: ${serviceCount}`);
  console.log(`Appointments: ${appointmentCount}`);
  console.log('\n✅ Database seeding completed successfully!');
  
  console.log('\n🔑 TEST USER LOGIN CREDENTIALS:');
  console.log('================================');
  console.log('\n📋 ADMIN:');
  console.log('   Email: admin@physio.com');
  console.log('   Password: Admin@123');
  console.log('   Access: Full system access');
  
  console.log('\n📋 RECEPTIONIST:');
  console.log('   Email: receptionist@physio.com');
  console.log('   Password: Reception@123');
  console.log('   Email: receptionist2@physio.com');
  console.log('   Password: Reception@123');
  console.log('   Access: Patient registration, assignment, scheduling');
  
  console.log('\n📋 SPECIALISTS (Review Patients):');
  console.log('   Neurologist Specialist:');
  console.log('     Email: neurologist@physio.com');
  console.log('     Password: Specialist@123');
  console.log('   Orthopedist Specialist:');
  console.log('     Email: orthopedist@physio.com');
  console.log('     Password: Specialist@123');
  console.log('   Physiotherapist Specialist:');
  console.log('     Email: physiospecialist@physio.com');
  console.log('     Password: Specialist@123');
  console.log('   Access: Review patients, create assessments, refer to therapists');
  
  console.log('\n📋 THERAPISTS (Provide Treatment):');
  console.log('   Physiotherapy Therapist:');
  console.log('     Email: physiotherapist@physio.com');
  console.log('     Password: Therapist@123');
  console.log('   Occupational Therapy Therapist:');
  console.log('     Email: occupationaltherapist@physio.com');
  console.log('     Password: Therapist@123');
  console.log('   Speech Therapy Therapist:');
  console.log('     Email: speechtherapist@physio.com');
  console.log('     Password: Therapist@123');
  console.log('   Access: Treat patients, create treatment plans, prepare for discharge');
  
  console.log('\n📋 NURSES:');
  console.log('   Email: nurse1@physio.com');
  console.log('   Password: Nurse@123');
  console.log('   Email: nurse2@physio.com');
  console.log('   Password: Nurse@123');
  console.log('   Access: Home care, patient management, health records');
  
  console.log('\n💡 WORKFLOW TESTING:');
  console.log('   - Receptionist registers patient → assigns to Specialist');
  console.log('   - Specialist reviews patient → refers to Therapist');
  console.log('   - Therapist treats patient → marks ready for discharge');
  console.log('   - Receptionist processes discharge');
  console.log('   - For home care: Receptionist assigns Nurse');
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
