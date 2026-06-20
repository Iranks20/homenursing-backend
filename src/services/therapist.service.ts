import { Prisma, UserRole, TherapistSpecialization } from '@prisma/client';

type TherapistStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

type Therapist = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  licenseNumber: string | null;
  specialization: string;
  experience: number;
  certifications: string[];
  hourlyRate: number | null;
  bio: string | null;
  status: TherapistStatus;
  hireDate: Date;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
  username?: string | null;
};
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';
import { PasswordService } from '../utils/password';

export interface CreateTherapistData {
  username: string;
  name: string;
  email?: string | null;
  password: string;
  phone: string;
  licenseNumber?: string | null;
  specialization: string;
  experience: number;
  certifications?: string[];
  hourlyRate?: number | null;
  bio?: string;
  hireDate: Date;
  dateOfBirth?: Date | null;
  avatar?: string;
}

export interface UpdateTherapistData extends Partial<Omit<CreateTherapistData, 'hireDate'>> {
  hireDate?: Date;
  status?: TherapistStatus;
}

const toPrismaDate = (date: Date | string | number): Date => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    throw new CustomError('Invalid date value', 400);
  }
  return parsed;
};

export class TherapistService {
  private static async findLinkedUser(input: {
    email?: string | null;
    licenseNumber?: string | null;
    phone?: string | null;
  }) {
    const where: Prisma.UserWhereInput = {
      role: UserRole.THERAPIST,
      OR: [],
    };

    if (input.email) {
      (where.OR as Prisma.UserWhereInput[]).push({ email: input.email.toLowerCase() });
    }

    if (input.licenseNumber) {
      (where.OR as Prisma.UserWhereInput[]).push({ licenseNumber: input.licenseNumber });
    }

    if (input.phone) {
      (where.OR as Prisma.UserWhereInput[]).push({ phone: input.phone });
    }

    if (!where.OR || (where.OR as Prisma.UserWhereInput[]).length === 0) {
      return null;
    }

    return prisma.user.findFirst({
      where,
      select: { id: true, username: true, email: true, name: true, phone: true, licenseNumber: true },
    });
  }
  static async createTherapist(data: CreateTherapistData): Promise<Therapist> {
    const emailVal = data.email?.trim() || null;
    if (emailVal) {
      const existingUser = await prisma.user.findUnique({ where: { email: emailVal.toLowerCase() } });
      if (existingUser) throw new CustomError('User with this email already exists', 409);
      const existing = await (prisma as any).therapist.findUnique({ where: { email: emailVal } });
      if (existing) throw new CustomError('Therapist with this email already exists', 409);
    }

    if (!data.password || data.password.length < 8) {
      throw new CustomError('Password must be at least 8 characters long', 400);
    }

    const usernameNormalized = (data.username || '').trim().toLowerCase();
    if (!usernameNormalized) throw new CustomError('Username is required', 400);
    const existingByUsername = await prisma.user.findUnique({ where: { username: usernameNormalized } });
    if (existingByUsername) throw new CustomError('Username is already taken', 409);

    const hashedPassword = await PasswordService.hashPassword(data.password);

    const specializationMap: Record<string, TherapistSpecialization> = {
      'PHYSIOTHERAPY': TherapistSpecialization.PHYSIOTHERAPY,
      'OCCUPATIONAL_THERAPY': TherapistSpecialization.OCCUPATIONAL_THERAPY,
      'SPEECH_THERAPY': TherapistSpecialization.SPEECH_THERAPY,
      'SPORTS_THERAPY': TherapistSpecialization.SPORTS_THERAPY,
      'PEDIATRIC_THERAPY': TherapistSpecialization.PEDIATRIC_THERAPY,
      'GERIATRIC_THERAPY': TherapistSpecialization.GERIATRIC_THERAPY,
    };
    const therapistSpecialization = specializationMap[data.specialization.toUpperCase()] || TherapistSpecialization.PHYSIOTHERAPY;

    const licenseNumberVal: string | null = data.licenseNumber?.trim() || null;
    const user = await prisma.user.create({
      data: {
        username: usernameNormalized,
        name: data.name,
        password: hashedPassword,
        role: UserRole.THERAPIST,
        phone: data.phone,
        therapistSpecialization: therapistSpecialization,
        department: 'Therapy Services',
        isActive: true,
        isVerified: true,
        email: emailVal,
        licenseNumber: licenseNumberVal,
        ...(data.dateOfBirth ? { dateOfBirth: toPrismaDate(data.dateOfBirth) } : {}),
      } as Prisma.UserCreateInput,
    });

    const hourlyRateVal = data.hourlyRate != null && data.hourlyRate > 0 ? data.hourlyRate : null;
    const therapist = await (prisma as any).therapist.create({
      data: {
        name: data.name,
        email: emailVal,
        phone: data.phone,
        ...(data.dateOfBirth ? { dateOfBirth: toPrismaDate(data.dateOfBirth) } : {}),
        licenseNumber: licenseNumberVal,
        specialization: data.specialization,
        experience: data.experience,
        certifications: data.certifications ?? [],
        hourlyRate: hourlyRateVal,
        hireDate: toPrismaDate(data.hireDate),
        status: 'ACTIVE' as TherapistStatus,
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
      },
    });
    logger.info('Therapist created with user account', { therapistId: therapist.id, userId: user.id });
    return therapist as Therapist;
  }

  static async getTherapistById(id: string): Promise<Therapist | null> {
    const therapist = await (prisma as any).therapist.findUnique({
      where: { id },
      include: { appointments: true },
    });
    if (!therapist) return null;
    let username: string | null = null;
    if (therapist.email) {
      const user = await prisma.user.findFirst({
        where: { role: UserRole.THERAPIST, email: therapist.email },
        select: { username: true },
      });
      username = user?.username ?? null;
    }
    return { ...therapist, username } as Therapist;
  }

  static async getTherapists(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [therapists, total] = await Promise.all([
      (prisma as any).therapist.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }) as Promise<Therapist[]>,
      (prisma as any).therapist.count(),
    ]);
    return { therapists, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  static async updateTherapist(id: string, data: UpdateTherapistData): Promise<Therapist> {
    const existing = await (prisma as any).therapist.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Therapist not found', 404);
    }

    const user = await this.findLinkedUser({
      email: existing.email,
      licenseNumber: existing.licenseNumber,
      phone: existing.phone,
    });

    const usernameNormalized =
      data.username !== undefined ? (data.username || '').trim().toLowerCase() : undefined;
    const emailVal = data.email !== undefined ? (data.email?.trim() || null) : undefined;

    if (usernameNormalized !== undefined && usernameNormalized !== '') {
      const existingByUsername = await prisma.user.findUnique({ where: { username: usernameNormalized } });
      if (existingByUsername && existingByUsername.id !== user?.id) {
        throw new CustomError('Username is already taken', 409);
      }
    }

    if (emailVal !== undefined && emailVal) {
      const existingUser = await prisma.user.findUnique({ where: { email: emailVal.toLowerCase() } });
      if (existingUser && existingUser.id !== user?.id) {
        throw new CustomError('User with this email already exists', 409);
      }
      const existingTherapist = await (prisma as any).therapist.findUnique({ where: { email: emailVal } });
      if (existingTherapist && existingTherapist.id !== id) {
        throw new CustomError('Therapist with this.email already exists', 409);
      }
    }

    if (user) {
      const userUpdates: Prisma.UserUpdateInput = {};
      if (usernameNormalized !== undefined) userUpdates.username = usernameNormalized || user.username;
      if (emailVal !== undefined) userUpdates.email = emailVal;
      if (data.name !== undefined) userUpdates.name = data.name;
      if (data.phone !== undefined) userUpdates.phone = data.phone;
      if (data.licenseNumber !== undefined) {
        const v = data.licenseNumber?.trim() || null;
        userUpdates.licenseNumber = v as string | null;
      }
      if (data.dateOfBirth !== undefined) {
        userUpdates.dateOfBirth = data.dateOfBirth ? toPrismaDate(data.dateOfBirth) : null;
      }
      if (Object.keys(userUpdates).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data: userUpdates });
      }
    }

    const updates: any = {};

    if (data.name !== undefined) updates.name = data.name;
    if (emailVal !== undefined) updates.email = emailVal;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.licenseNumber !== undefined) {
      updates.licenseNumber =
        data.licenseNumber && data.licenseNumber.trim() !== '' ? data.licenseNumber.trim() : null;
    }
    if (data.specialization !== undefined) updates.specialization = data.specialization;
    if (data.experience !== undefined) updates.experience = data.experience;
    if (data.certifications !== undefined) updates.certifications = data.certifications;
    if (data.hourlyRate !== undefined) {
      updates.hourlyRate = data.hourlyRate != null && data.hourlyRate > 0 ? data.hourlyRate : null;
    }
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.hireDate !== undefined) updates.hireDate = toPrismaDate(data.hireDate);
    if (data.dateOfBirth !== undefined) {
      updates.dateOfBirth = data.dateOfBirth ? toPrismaDate(data.dateOfBirth) : null;
    }
    if (data.avatar !== undefined) updates.avatar = data.avatar;
    if (data.status !== undefined) updates.status = data.status;

    return (prisma as any).therapist.update({ where: { id }, data: updates }) as Promise<Therapist>;
  }

  static async deleteTherapist(id: string): Promise<void> {
    await (prisma as any).therapist.update({ where: { id }, data: { status: 'INACTIVE' as TherapistStatus } });
  }
}
