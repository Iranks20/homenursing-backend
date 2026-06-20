import { Prisma, Nurse, NurseStatus, UserRole, PayFrequency } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';
import { PasswordService } from '../utils/password';

export interface CreateNurseData {
  username: string;
  name: string;
  email?: string | null;
  password: string;
  phone: string;
  licenseNumber?: string | null;
  specialization: string;
  experience: number;
  certifications?: string[];
  hireDate: Date;
  dateOfBirth?: Date | null;
  avatar?: string;
  payFrequency?: 'WEEKLY' | 'MONTHLY' | null;
  workStartDate?: Date | null;
}

export type UpdateNurseData = Partial<CreateNurseData> & { status?: NurseStatus };

export class NurseService {
  static async createNurse(data: CreateNurseData): Promise<Nurse> {
    const emailVal = data.email?.trim() || null;
    if (emailVal) {
      const existingUser = await prisma.user.findUnique({ where: { email: emailVal.toLowerCase() } });
      if (existingUser) throw new CustomError('User with this email already exists', 409);
      const existingNurse = await prisma.nurse.findUnique({
        where: { email: emailVal }
      });
      if (existingNurse) {
        throw new CustomError('Nurse with this email already exists', 409);
      }
    }

    // Validate password
    if (!data.password || data.password.length < 8) {
      throw new CustomError('Password must be at least 8 characters long', 400);
    }

    // Hash password
    const hashedPassword = await PasswordService.hashPassword(data.password);

    const usernameNormalized = (data.username || '').trim().toLowerCase();
    if (!usernameNormalized) throw new CustomError('Username is required', 400);
    const existingByUsername = await prisma.user.findUnique({ where: { username: usernameNormalized } });
    if (existingByUsername) throw new CustomError('Username is already taken', 409);

    const licenseForUser: string | null = data.licenseNumber?.trim() || null;
    const user = await prisma.user.create({
      data: {
        username: usernameNormalized,
        name: data.name,
        password: hashedPassword,
        role: UserRole.NURSE,
        phone: data.phone,
        department: 'Home Care',
        isActive: true,
        isVerified: true,
        email: emailVal,
        licenseNumber: licenseForUser,
        payFrequency: data.payFrequency ?? null,
        workStartDate: data.workStartDate ?? new Date(data.hireDate),
        ...(data.dateOfBirth ? { dateOfBirth: new Date(data.dateOfBirth) } : {}),
      } as Prisma.UserCreateInput,
    });

    const licenseNumberValue: string | null = data.licenseNumber?.trim() || null;
    const nurse = await prisma.nurse.create({
      data: {
        name: data.name,
        phone: data.phone,
        ...(data.dateOfBirth ? { dateOfBirth: new Date(data.dateOfBirth) } : {}),
        licenseNumber: licenseNumberValue,
        specialization: data.specialization,
        experience: data.experience,
        certifications: data.certifications ?? [],
        hireDate: new Date(data.hireDate),
        email: emailVal,
        avatar: data.avatar && data.avatar !== '' ? data.avatar : null,
      } as Prisma.NurseCreateInput,
    });

    logger.info('Nurse created with user account', { nurseId: nurse.id, userId: user.id });
    return nurse;
  }

  static async getNurseById(id: string): Promise<Nurse | null> {
    return prisma.nurse.findUnique({
      where: { id },
      include: {
        appointments: true,
        schedules: true,
      }
    });
  }

  static async getNurses(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [nurses, total] = await Promise.all([
      prisma.nurse.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.nurse.count()
    ]);

    return {
      nurses,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    };
  }

  static async updateNurse(id: string, data: UpdateNurseData): Promise<Nurse> {
    const existing = await prisma.nurse.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Nurse not found', 404);
    }

    if (data.email && data.email !== existing.email) {
      const emailExists = await prisma.nurse.findUnique({ where: { email: data.email } });
      if (emailExists) {
        throw new CustomError('Email already in use', 409);
      }
    }

    const updateData: Prisma.NurseUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) {
      const emailVal = data.email?.trim() || null;
      updateData.email = emailVal as string | null;
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.licenseNumber !== undefined) {
      const licenseNumberValue = data.licenseNumber?.trim() || null;
      updateData.licenseNumber = licenseNumberValue as string | null;
    }
    if (data.specialization !== undefined) updateData.specialization = data.specialization;
    if (data.experience !== undefined) updateData.experience = data.experience;
    if (data.certifications !== undefined) updateData.certifications = data.certifications;
    if (data.hireDate !== undefined) updateData.hireDate = new Date(data.hireDate);
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.status !== undefined) updateData.status = data.status;

    const nurse = await prisma.nurse.update({ where: { id }, data: updateData });

    const lookupEmail = (nurse.email ?? existing.email)?.trim().toLowerCase();
    const linkedUser = lookupEmail
      ? await prisma.user.findFirst({
          where: { email: lookupEmail, role: UserRole.NURSE },
        })
      : null;

    if (linkedUser) {
      const userUpdate: Prisma.UserUncheckedUpdateInput = {};
      if (data.name !== undefined) userUpdate.name = data.name;
      if (data.email !== undefined) userUpdate.email = data.email?.trim() || null;
      if (data.phone !== undefined) userUpdate.phone = data.phone;
      if (data.licenseNumber !== undefined) {
        userUpdate.licenseNumber = data.licenseNumber?.trim() || null;
      }
      if (data.payFrequency !== undefined) userUpdate.payFrequency = data.payFrequency;
      if (data.workStartDate !== undefined) {
        userUpdate.workStartDate = data.workStartDate ? new Date(data.workStartDate) : null;
      } else if (data.hireDate !== undefined) {
        userUpdate.workStartDate = new Date(data.hireDate);
      }
      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({ where: { id: linkedUser.id }, data: userUpdate });
      }
    }

    return nurse;
  }

  static async deleteNurse(id: string): Promise<void> {
    const existing = await prisma.nurse.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Nurse not found', 404);
    }

    await prisma.nurse.update({
      where: { id },
      data: { status: 'INACTIVE' }
    });
  }
}

