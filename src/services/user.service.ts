import { Prisma, User, UserRole, SpecialistSpecialization, SpecialistType, TherapistSpecialization, PayFrequency } from '@prisma/client';
import prisma from '../config/database';
import { PasswordService } from '../utils/password';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface CreateUserData {
  username: string;
  name: string;
  email?: string | null;
  password: string;
  role: UserRole;
  phone?: string;
  dateOfBirth?: Date | null;
  department?: string;
  avatar?: string;
  payFrequency?: PayFrequency | null;
  workStartDate?: Date | null;
}

export interface UpdateUserData {
  username?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  phone?: string;
  department?: string;
  avatar?: string | null;
  password?: string;
  specialistSpecialization?: string | null;
  specialistType?: string | null;
  therapistSpecialization?: string | null;
  employeeId?: string | null;
  licenseNumber?: string | null;
  consultationFee?: number | null;
  isActive?: boolean;
  dateOfBirth?: Date | null;
  payFrequency?: PayFrequency | null;
  workStartDate?: Date | null;
}

export interface UserFilters {
  query?: string;
  role?: UserRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export class UserService {
  /**
   * Create a new user
   */
  static async createUser(data: CreateUserData): Promise<Omit<User, 'password'>> {
    const usernameNormalized = data.username.trim().toLowerCase();
    const emailVal = data.email?.trim() || null;
    if (emailVal) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email: emailVal }
      });
      if (existingByEmail) {
        throw new CustomError('User with this email already exists', 409);
      }
    }
    const existingByUsername = await prisma.user.findUnique({
      where: { username: usernameNormalized }
    });
    if (existingByUsername) {
      throw new CustomError('Username is already taken', 409);
    }

    const hashedPassword = await PasswordService.hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        ...data,
        email: emailVal ?? undefined,
        username: usernameNormalized,
        password: hashedPassword,
      } as Prisma.UserUncheckedCreateInput,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        specialistSpecialization: true,
        therapistSpecialization: true,
        specialistType: true,
        phone: true,
        dateOfBirth: true,
        avatar: true,
        department: true,
        employeeId: true,
        licenseNumber: true,
        consultationFee: true,
        payFrequency: true,
        workStartDate: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    logger.info('User created', { userId: user.id, username: user.username, email: user.email });
    return user;
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        specialistSpecialization: true,
        therapistSpecialization: true,
        specialistType: true,
        phone: true,
        dateOfBirth: true,
        avatar: true,
        department: true,
        employeeId: true,
        licenseNumber: true,
        consultationFee: true,
        payFrequency: true,
        workStartDate: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return user;
  }

  /**
   * Get all users with pagination and filters
   */
  static async getUsers(filters: UserFilters = {}) {
    const { query, role, isActive, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { username: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (role) {
      // Convert role to uppercase to match UserRole enum
      const normalizedRole = typeof role === 'string' ? role.toUpperCase() : role;
      where.role = normalizedRole as UserRole;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          specialistSpecialization: true,
          therapistSpecialization: true,
          specialistType: true,
          phone: true,
          avatar: true,
          department: true,
          employeeId: true,
          licenseNumber: true,
          consultationFee: true,
          isActive: true,
          isVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        }
      }),
      prisma.user.count({ where })
    ]);

    if (users.some((u) => u.role === UserRole.SPECIALIST)) {
      const specialists = await prisma.specialist.findMany({
        select: { email: true, name: true, specialization: true },
      });
      const byEmail = new Map<string, string>();
      const byName = new Map<string, string>();
      specialists.forEach((s) => {
        if (s.email) byEmail.set(s.email.toLowerCase().trim(), s.specialization);
        byName.set(s.name.trim().toLowerCase(), s.specialization);
      });
      users.forEach((u) => {
        if (u.role !== UserRole.SPECIALIST) return;
        const emailKey = u.email?.toLowerCase().trim();
        const nameKey = u.name?.trim().toLowerCase();
        const spec = (emailKey && byEmail.get(emailKey)) ?? (nameKey && byName.get(nameKey));
        if (spec) (u as { specialization?: string }).specialization = spec;
      });
    }

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  /**
   * Update user
   */
  static async updateUser(id: string, data: UpdateUserData): Promise<Omit<User, 'password'>> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      throw new CustomError('User not found', 404);
    }

    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email }
      });
      if (emailExists) {
        throw new CustomError('Email already in use', 409);
      }
    }

    if (data.username !== undefined) {
      const usernameNormalized = data.username.trim().toLowerCase();
      const usernameExists = await prisma.user.findFirst({
        where: { username: usernameNormalized, id: { not: id } }
      });
      if (usernameExists) {
        throw new CustomError('Username is already taken', 409);
      }
    }

    const updateData: Prisma.UserUncheckedUpdateInput = {};
    if (data.username !== undefined) updateData.username = data.username.trim().toLowerCase();
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }
    if (data.department !== undefined) updateData.department = data.department;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
    if (data.licenseNumber !== undefined) updateData.licenseNumber = data.licenseNumber;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.specialistSpecialization !== undefined) {
      updateData.specialistSpecialization = data.specialistSpecialization as SpecialistSpecialization | null;
    }
    if (data.specialistType !== undefined) {
      updateData.specialistType = data.specialistType as SpecialistType | null;
    }
    if (data.therapistSpecialization !== undefined) {
      updateData.therapistSpecialization = data.therapistSpecialization as TherapistSpecialization | null;
    }
    if (data.consultationFee !== undefined) {
      updateData.consultationFee = data.consultationFee;
    }
    if (data.payFrequency !== undefined) updateData.payFrequency = data.payFrequency;
    if (data.workStartDate !== undefined) {
      updateData.workStartDate = data.workStartDate ? new Date(data.workStartDate) : null;
    }
    if (data.password) {
      updateData.password = await PasswordService.hashPassword(data.password);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        specialistSpecialization: true,
        therapistSpecialization: true,
        specialistType: true,
        phone: true,
        dateOfBirth: true,
        avatar: true,
        department: true,
        employeeId: true,
        licenseNumber: true,
        consultationFee: true,
        payFrequency: true,
        workStartDate: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    logger.info('User updated', { userId: user.id });
    return user;
  }

  /**
   * Update user status
   */
  static async updateUserStatus(id: string, isActive: boolean): Promise<Omit<User, 'password'>> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('User not found', 404);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        specialistSpecialization: true,
        therapistSpecialization: true,
        specialistType: true,
        phone: true,
        dateOfBirth: true,
        avatar: true,
        department: true,
        employeeId: true,
        licenseNumber: true,
        consultationFee: true,
        payFrequency: true,
        workStartDate: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    logger.info('User status updated', { userId: user.id, isActive });
    return user;
  }

  /**
   * Delete user permanently (hard delete)
   */
  static async deleteUser(id: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new CustomError('User not found', 404);
    }

    // Permanently delete the user
    // Note: This will cascade delete related records due to onDelete: Cascade in schema
    await prisma.user.delete({
      where: { id }
    });

    logger.info('User permanently deleted', { userId: id, email: user.email });
  }

  /**
   * Get current user profile
   */
  static async getCurrentUserProfile(userId: string): Promise<Omit<User, 'password'>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        specialistSpecialization: true,
        therapistSpecialization: true,
        specialistType: true,
        phone: true,
        dateOfBirth: true,
        avatar: true,
        department: true,
        employeeId: true,
        licenseNumber: true,
        consultationFee: true,
        payFrequency: true,
        workStartDate: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    return user;
  }

  /**
   * Update current user profile
   */
  static async updateCurrentUserProfile(userId: string, data: UpdateUserData): Promise<Omit<User, 'password'>> {
    return this.updateUser(userId, data);
  }

  /**
   * Search users
   */
  static async searchUsers(filters: UserFilters) {
    return this.getUsers(filters);
  }

  /**
   * Get user activity log
   */
  static async getUserActivity(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where: { userId } })
    ]);

    return {
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }
}

