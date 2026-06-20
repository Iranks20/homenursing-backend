"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting database seed...');
    const hashPassword = async (password) => {
        return bcryptjs_1.default.hash(password, 12);
    };
    console.log('Creating admin user...');
    const adminPassword = await hashPassword('Admin@123');
    const admin = await prisma.user.upsert({
        where: { email: 'admin@homecare.com' },
        update: {},
        create: {
            email: 'admin@homecare.com',
            name: 'Admin User',
            password: adminPassword,
            role: client_1.UserRole.ADMIN,
            phone: '+1234567890',
            department: 'Administration',
            isActive: true,
            isVerified: true,
        },
    });
    console.log('✅ Admin user created:', admin.email);
    console.log('Creating nurse users...');
    const nurse1Password = await hashPassword('Nurse@123');
    const nurseUser1 = await prisma.user.upsert({
        where: { email: 'nurse1@homecare.com' },
        update: {},
        create: {
            email: 'nurse1@homecare.com',
            name: 'Sarah Johnson',
            password: nurse1Password,
            role: client_1.UserRole.NURSE,
            phone: '+1234567891',
            department: 'General Care',
            isActive: true,
            isVerified: true,
        },
    });
    const nurse2Password = await hashPassword('Nurse@123');
    const nurseUser2 = await prisma.user.upsert({
        where: { email: 'nurse2@homecare.com' },
        update: {},
        create: {
            email: 'nurse2@homecare.com',
            name: 'Michael Chen',
            password: nurse2Password,
            role: client_1.UserRole.NURSE,
            phone: '+1234567892',
            department: 'Critical Care',
            isActive: true,
            isVerified: true,
        },
    });
    console.log('✅ Nurse users created');
    console.log('Creating nurses...');
    const nurse1 = await prisma.nurse.upsert({
        where: { email: 'sarah.johnson@homecare.com' },
        update: {},
        create: {
            name: 'Sarah Johnson',
            email: 'sarah.johnson@homecare.com',
            phone: '+1234567891',
            licenseNumber: 'RN-001234',
            specialization: 'General Care',
            experience: 5,
            certifications: ['CPR', 'ACLS', 'BLS'],
            status: client_1.NurseStatus.ACTIVE,
            hireDate: new Date('2020-01-15'),
        },
    });
    const nurse2 = await prisma.nurse.upsert({
        where: { email: 'michael.chen@homecare.com' },
        update: {},
        create: {
            name: 'Michael Chen',
            email: 'michael.chen@homecare.com',
            phone: '+1234567892',
            licenseNumber: 'RN-001235',
            specialization: 'Critical Care',
            experience: 8,
            certifications: ['CPR', 'ACLS', 'PALS', 'Critical Care'],
            status: client_1.NurseStatus.ACTIVE,
            hireDate: new Date('2019-06-01'),
        },
    });
    console.log('✅ Nurses created');
    console.log('Creating specialists...');
    const specialist1 = await prisma.specialist.upsert({
        where: { email: 'dr.smith@homecare.com' },
        update: {},
        create: {
            name: 'Dr. John Smith',
            email: 'dr.smith@homecare.com',
            phone: '+1234567893',
            licenseNumber: 'MD-001234',
            specialization: client_1.SpecialistType.MEDICAL_DOCTOR,
            experience: 15,
            certifications: ['MD', 'Internal Medicine'],
            hourlyRate: 200.0,
            bio: 'Experienced medical doctor specializing in geriatric care',
            status: client_1.SpecialistStatus.ACTIVE,
            hireDate: new Date('2018-01-01'),
        },
    });
    const specialist2 = await prisma.specialist.upsert({
        where: { email: 'dr.williams@homecare.com' },
        update: {},
        create: {
            name: 'Dr. Emily Williams',
            email: 'dr.williams@homecare.com',
            phone: '+1234567894',
            licenseNumber: 'PT-001234',
            specialization: client_1.SpecialistType.GERIATRICIAN,
            experience: 12,
            certifications: ['MD', 'Geriatrics'],
            hourlyRate: 220.0,
            bio: 'Board-certified geriatrician with extensive experience',
            status: client_1.SpecialistStatus.ACTIVE,
            hireDate: new Date('2019-03-15'),
        },
    });
    console.log('✅ Specialists created');
    console.log('Creating services...');
    const service1 = await prisma.service.upsert({
        where: { id: 'service-1' },
        update: {},
        create: {
            id: 'service-1',
            name: 'Home Health Nursing',
            description: 'Professional nursing care at home including medication management, wound care, and vital signs monitoring',
            category: client_1.ServiceCategory.NURSING,
            price: 150.0,
            duration: 60,
            features: ['Medication Management', 'Wound Care', 'Vital Signs Monitoring', 'Health Assessment'],
            isActive: true,
        },
    });
    const service2 = await prisma.service.upsert({
        where: { id: 'service-2' },
        update: {},
        create: {
            id: 'service-2',
            name: 'Physical Therapy',
            description: 'Personalized physical therapy sessions to improve mobility and strength',
            category: client_1.ServiceCategory.PHYSIOTHERAPY,
            price: 180.0,
            duration: 60,
            features: ['Mobility Training', 'Strength Building', 'Pain Management', 'Exercise Programs'],
            isActive: true,
        },
    });
    const service3 = await prisma.service.upsert({
        where: { id: 'service-3' },
        update: {},
        create: {
            id: 'service-3',
            name: 'Palliative Care',
            description: 'Comprehensive palliative care services for patients with serious illnesses',
            category: client_1.ServiceCategory.PALLIATIVE,
            price: 200.0,
            duration: 90,
            features: ['Pain Management', 'Symptom Control', 'Emotional Support', 'Family Counseling'],
            isActive: true,
        },
    });
    console.log('✅ Services created');
    console.log('Creating patients...');
    const patient1 = await prisma.patient.upsert({
        where: { email: 'alice.thompson@example.com' },
        update: {
            name: 'Alice Thompson',
            phone: '+1234567895',
            dateOfBirth: new Date('1950-05-15'),
            address: '123 Main Street, City, State 12345',
            condition: 'Diabetes Management',
            status: client_1.PatientStatus.ACTIVE,
            assignedNurseId: nurse1.id,
            admissionDate: new Date('2024-01-10'),
        },
        create: {
            name: 'Alice Thompson',
            email: 'alice.thompson@example.com',
            phone: '+1234567895',
            dateOfBirth: new Date('1950-05-15'),
            address: '123 Main Street, City, State 12345',
            condition: 'Diabetes Management',
            status: client_1.PatientStatus.ACTIVE,
            assignedNurseId: nurse1.id,
            admissionDate: new Date('2024-01-10'),
        },
    });
    const patient2 = await prisma.patient.upsert({
        where: { email: 'robert.martinez@example.com' },
        update: {
            name: 'Robert Martinez',
            phone: '+1234567896',
            dateOfBirth: new Date('1945-08-20'),
            address: '456 Oak Avenue, City, State 12346',
            condition: 'Post-Surgery Recovery',
            status: client_1.PatientStatus.ACTIVE,
            assignedNurseId: nurse2.id,
            admissionDate: new Date('2024-01-15'),
        },
        create: {
            name: 'Robert Martinez',
            email: 'robert.martinez@example.com',
            phone: '+1234567896',
            dateOfBirth: new Date('1945-08-20'),
            address: '456 Oak Avenue, City, State 12346',
            condition: 'Post-Surgery Recovery',
            status: client_1.PatientStatus.ACTIVE,
            assignedNurseId: nurse2.id,
            admissionDate: new Date('2024-01-15'),
        },
    });
    const patient3 = await prisma.patient.upsert({
        where: { email: 'mary.davis@example.com' },
        update: {
            name: 'Mary Davis',
            phone: '+1234567897',
            dateOfBirth: new Date('1960-12-10'),
            address: '789 Pine Road, City, State 12347',
            condition: 'Hypertension Management',
            status: client_1.PatientStatus.ACTIVE,
            assignedNurseId: nurse1.id,
            admissionDate: new Date('2024-01-20'),
        },
        create: {
            name: 'Mary Davis',
            email: 'mary.davis@example.com',
            phone: '+1234567897',
            dateOfBirth: new Date('1960-12-10'),
            address: '789 Pine Road, City, State 12347',
            condition: 'Hypertension Management',
            status: client_1.PatientStatus.ACTIVE,
            assignedNurseId: nurse1.id,
            admissionDate: new Date('2024-01-20'),
        },
    });
    console.log('✅ Patients created');
    console.log('Creating appointments...');
    const appointment1 = await prisma.appointment.create({
        data: {
            patientId: patient1.id,
            nurseId: nurse1.id,
            serviceId: service1.id,
            date: new Date('2024-02-15'),
            time: '10:00',
            duration: 60,
            status: client_1.AppointmentStatus.SCHEDULED,
            notes: 'Regular check-up and medication review',
        },
    });
    const appointment2 = await prisma.appointment.create({
        data: {
            patientId: patient2.id,
            nurseId: nurse2.id,
            specialistId: specialist1.id,
            serviceId: service2.id,
            date: new Date('2024-02-16'),
            time: '14:00',
            duration: 60,
            status: client_1.AppointmentStatus.SCHEDULED,
            notes: 'Physical therapy session',
        },
    });
    console.log('✅ Appointments created');
    console.log('Creating medical records...');
    await prisma.medicalRecord.create({
        data: {
            patientId: patient1.id,
            date: new Date('2024-01-10'),
            diagnosis: 'Type 2 Diabetes',
            treatment: 'Insulin therapy and dietary management',
            notes: 'Patient responding well to treatment. Blood sugar levels stable.',
            doctor: 'Dr. John Smith',
        },
    });
    await prisma.medicalRecord.create({
        data: {
            patientId: patient2.id,
            date: new Date('2024-01-15'),
            diagnosis: 'Post-Surgical Recovery',
            treatment: 'Wound care and physical therapy',
            notes: 'Patient recovering well. Incision healing properly.',
            doctor: 'Dr. Emily Williams',
        },
    });
    console.log('✅ Medical records created');
    console.log('Creating health record updates...');
    await prisma.healthRecordUpdate.create({
        data: {
            patientId: patient1.id,
            updatedBy: admin.id,
            updatedByName: admin.name,
            updatedByRole: client_1.RecordRole.NURSE,
            recordType: client_1.RecordType.VITAL,
            data: {
                bloodPressure: { systolic: 120, diastolic: 80 },
                heartRate: 72,
                temperature: 98.6,
                weight: 165,
            },
            location: 'Home',
            notes: 'Regular vital signs check',
            verified: true,
            verifiedBy: admin.id,
            verifiedAt: new Date(),
        },
    });
    console.log('✅ Health record updates created');
    console.log('\n📊 Seed Summary:');
    console.log('================');
    const userCount = await prisma.user.count();
    const patientCount = await prisma.patient.count();
    const nurseCount = await prisma.nurse.count();
    const specialistCount = await prisma.specialist.count();
    const serviceCount = await prisma.service.count();
    const appointmentCount = await prisma.appointment.count();
    console.log(`Users: ${userCount}`);
    console.log(`Patients: ${patientCount}`);
    console.log(`Nurses: ${nurseCount}`);
    console.log(`Specialists: ${specialistCount}`);
    console.log(`Services: ${serviceCount}`);
    console.log(`Appointments: ${appointmentCount}`);
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n🔑 Default Login Credentials:');
    console.log('Admin: admin@homecare.com / Admin@123');
    console.log('Nurse 1: nurse1@homecare.com / Nurse@123');
    console.log('Nurse 2: nurse2@homecare.com / Nurse@123');
}
main()
    .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map