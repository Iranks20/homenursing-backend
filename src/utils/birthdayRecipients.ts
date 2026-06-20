import {
  BirthdaySmsRecipientType,
  NurseStatus,
  PatientStatus,
  SpecialistStatus,
  TherapistStatus,
  UserRole,
} from '@prisma/client';
import prisma from '../config/database';
import { isLikelyValidPhone, normalizePhoneNumber } from '../services/egoSms.service';
import { matchesBirthdayUtc } from './appointmentReminderSchedule';

export type BirthdayRecipientCandidate = {
  recipientType: BirthdaySmsRecipientType;
  recipientId: string;
  recipientName: string;
  phone: string;
};

const STAFF_USER_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.RECEPTIONIST,
  UserRole.BILLER,
  UserRole.LAB_ATTENDANT,
];

const pushCandidate = (
  list: BirthdayRecipientCandidate[],
  seenPhones: Set<string>,
  candidate: BirthdayRecipientCandidate
): void => {
  const phone = normalizePhoneNumber(candidate.phone);
  if (!isLikelyValidPhone(phone)) {
    return;
  }
  if (seenPhones.has(phone)) {
    return;
  }
  seenPhones.add(phone);
  list.push({ ...candidate, phone });
};

export const collectBirthdayRecipientsForDate = async (
  referenceDate: Date
): Promise<BirthdayRecipientCandidate[]> => {
  const seenPhones = new Set<string>();
  const recipients: BirthdayRecipientCandidate[] = [];

  const patients = await prisma.patient.findMany({
    where: { status: PatientStatus.ACTIVE },
    select: { id: true, name: true, phone: true, dateOfBirth: true },
  });
  for (const row of patients) {
    if (!matchesBirthdayUtc(row.dateOfBirth, referenceDate)) continue;
    pushCandidate(recipients, seenPhones, {
      recipientType: BirthdaySmsRecipientType.PATIENT,
      recipientId: row.id,
      recipientName: row.name,
      phone: row.phone ?? '',
    });
  }

  const specialists = await prisma.specialist.findMany({
    where: { status: SpecialistStatus.ACTIVE, dateOfBirth: { not: null } },
    select: { id: true, name: true, phone: true, dateOfBirth: true },
  });
  for (const row of specialists) {
    if (!row.dateOfBirth || !matchesBirthdayUtc(row.dateOfBirth, referenceDate)) continue;
    pushCandidate(recipients, seenPhones, {
      recipientType: BirthdaySmsRecipientType.SPECIALIST,
      recipientId: row.id,
      recipientName: row.name,
      phone: row.phone,
    });
  }

  const therapists = await prisma.therapist.findMany({
    where: { status: TherapistStatus.ACTIVE, dateOfBirth: { not: null } },
    select: { id: true, name: true, phone: true, dateOfBirth: true },
  });
  for (const row of therapists) {
    if (!row.dateOfBirth || !matchesBirthdayUtc(row.dateOfBirth, referenceDate)) continue;
    pushCandidate(recipients, seenPhones, {
      recipientType: BirthdaySmsRecipientType.THERAPIST,
      recipientId: row.id,
      recipientName: row.name,
      phone: row.phone,
    });
  }

  const nurses = await prisma.nurse.findMany({
    where: { status: NurseStatus.ACTIVE, dateOfBirth: { not: null } },
    select: { id: true, name: true, phone: true, dateOfBirth: true },
  });
  for (const row of nurses) {
    if (!row.dateOfBirth || !matchesBirthdayUtc(row.dateOfBirth, referenceDate)) continue;
    pushCandidate(recipients, seenPhones, {
      recipientType: BirthdaySmsRecipientType.NURSE,
      recipientId: row.id,
      recipientName: row.name,
      phone: row.phone,
    });
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      dateOfBirth: { not: null },
      role: { in: STAFF_USER_ROLES },
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true, dateOfBirth: true },
  });
  for (const row of users) {
    if (!row.dateOfBirth || !row.phone || !matchesBirthdayUtc(row.dateOfBirth, referenceDate)) continue;
    pushCandidate(recipients, seenPhones, {
      recipientType: BirthdaySmsRecipientType.USER,
      recipientId: row.id,
      recipientName: row.name,
      phone: row.phone,
    });
  }

  return recipients;
};
