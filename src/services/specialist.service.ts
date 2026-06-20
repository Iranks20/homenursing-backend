import { Specialist, SpecialistStatus, Prisma, UserRole, SpecialistSpecialization } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';
import { PasswordService } from '../utils/password';

export interface CreateSpecialistData {
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

export interface UpdateSpecialistData extends Partial<Omit<CreateSpecialistData, 'hireDate'>> {
  hireDate?: Date;
  status?: SpecialistStatus;
}

const toPrismaDate = (date: Date | string | number): Date => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    throw new CustomError('Invalid date value', 400);
  }
  return parsed;
};

export class SpecialistService {
  private static async findLinkedUser(input: {
    email?: string | null;
    licenseNumber?: string | null;
    phone?: string | null;
  }) {
    const where: Prisma.UserWhereInput = {
      role: UserRole.SPECIALIST,
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
      select: { id: true, username: true, email: true },
    });
  }

  static async createSpecialist(data: CreateSpecialistData): Promise<Specialist> {
    const emailVal = data.email?.trim() || null;
    if (emailVal) {
      const existingUser = await prisma.user.findUnique({ where: { email: emailVal.toLowerCase() } });
      if (existingUser) throw new CustomError('User with this email already exists', 409);
      const existing = await prisma.specialist.findUnique({ where: { email: emailVal } });
      if (existing) throw new CustomError('Specialist with this email already exists', 409);
    }

    if (!data.password || data.password.length < 8) {
      throw new CustomError('Password must be at least 8 characters long', 400);
    }

    const usernameNormalized = (data.username || '').trim().toLowerCase();
    if (!usernameNormalized) throw new CustomError('Username is required', 400);
    const existingByUsername = await prisma.user.findUnique({ where: { username: usernameNormalized } });
    if (existingByUsername) throw new CustomError('Username is already taken', 409);

    const hashedPassword = await PasswordService.hashPassword(data.password);

    const specializationMap: Record<string, SpecialistSpecialization> = {
      'NEUROLOGIST': SpecialistSpecialization.NEUROLOGIST,
      'ORTHOPEDIST': SpecialistSpecialization.ORTHOPEDIST,
      'PHYSIOTHERAPIST': SpecialistSpecialization.PHYSIOTHERAPIST,
    };
    const specialistSpecialization = specializationMap[data.specialization.toUpperCase()] || SpecialistSpecialization.NEUROLOGIST;

    const licenseNumberVal: string | null = data.licenseNumber?.trim() || null;
    const user = await prisma.user.create({
      data: {
        username: usernameNormalized,
        name: data.name,
        password: hashedPassword,
        role: UserRole.SPECIALIST,
        phone: data.phone,
        specialistSpecialization: specialistSpecialization,
        department: 'Specialist Services',
        isActive: true,
        isVerified: true,
        email: emailVal,
        licenseNumber: licenseNumberVal,
        ...(data.dateOfBirth ? { dateOfBirth: toPrismaDate(data.dateOfBirth) } : {}),
      } as Prisma.UserCreateInput,
    });

    const hourlyRateVal = data.hourlyRate != null && data.hourlyRate > 0 ? data.hourlyRate : null;
    const specialist = await prisma.specialist.create({
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
        status: SpecialistStatus.ACTIVE,
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.avatar !== undefined && { avatar: data.avatar }),
      } as Prisma.SpecialistUncheckedCreateInput,
    });
    logger.info('Specialist created with user account', { specialistId: specialist.id, userId: user.id });
    return specialist;
  }

  static async getSpecialistById(id: string): Promise<Specialist | null> {
    return prisma.specialist.findUnique({
      where: { id },
      include: { appointments: true, availability: true },
    });
  }

  static async getSpecialistDetailsById(
    id: string
  ): Promise<(Specialist & { username?: string; userEmail?: string | null }) | null> {
    const specialist = await prisma.specialist.findUnique({
      where: { id },
      include: { appointments: true, availability: true },
    });

    if (!specialist) {
      return null;
    }

    const user = await this.findLinkedUser({
      email: specialist.email,
      licenseNumber: specialist.licenseNumber,
      phone: specialist.phone,
    });

    return {
      ...specialist,
      ...(user?.username ? { username: user.username } : {}),
      ...(user?.email !== undefined ? { userEmail: user.email } : {}),
    };
  }

  static async getSpecialists(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [specialists, total] = await Promise.all([
      prisma.specialist.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.specialist.count(),
    ]);
    return { specialists, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  static async updateSpecialist(id: string, data: UpdateSpecialistData): Promise<Specialist> {
    const existing = await prisma.specialist.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Specialist not found', 404);
    }

    const user = await this.findLinkedUser({
      email: existing.email,
      licenseNumber: existing.licenseNumber,
      phone: existing.phone,
    });

    const usernameNormalized = data.username !== undefined ? (data.username || '').trim().toLowerCase() : undefined;
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
      const existingSpecialist = await prisma.specialist.findUnique({ where: { email: emailVal } });
      if (existingSpecialist && existingSpecialist.id !== id) {
        throw new CustomError('Specialist with this email already exists', 409);
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

    const updates: Prisma.SpecialistUpdateInput = {};

    if (data.name !== undefined) updates.name = data.name;
    if (emailVal !== undefined) updates.email = emailVal;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.licenseNumber !== undefined) {
      const v = data.licenseNumber?.trim() || null;
      updates.licenseNumber = v as string | null;
    }
    if (data.specialization !== undefined) updates.specialization = data.specialization;
    if (data.experience !== undefined) updates.experience = data.experience;
    if (data.certifications !== undefined) updates.certifications = data.certifications;
    if (data.hourlyRate !== undefined) updates.hourlyRate = data.hourlyRate != null && data.hourlyRate > 0 ? data.hourlyRate : null;
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.hireDate !== undefined) updates.hireDate = toPrismaDate(data.hireDate);
    if (data.dateOfBirth !== undefined) {
      updates.dateOfBirth = data.dateOfBirth ? toPrismaDate(data.dateOfBirth) : null;
    }
    if (data.avatar !== undefined) updates.avatar = data.avatar;
    if (data.status !== undefined) updates.status = data.status;

    return prisma.specialist.update({ where: { id }, data: updates });
  }

  static async deleteSpecialist(id: string): Promise<void> {
    await prisma.specialist.update({ where: { id }, data: { status: SpecialistStatus.INACTIVE } });
  }
}

