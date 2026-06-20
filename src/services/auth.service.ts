import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import { JWTService, JWTPayload } from '../utils/jwt';
import { PasswordService } from '../utils/password';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  department?: string;
}

type RoleSlug =
  | 'admin'
  | 'applicant'
  | 'nurse'
  | 'trainer'
  | 'supervisor'
  | 'receptionist'
  | 'specialist'
  | 'therapist'
  | 'biller'
  | 'lab_attendant';

type PrismaUserRole =
  | 'ADMIN'
  | 'APPLICANT'
  | 'NURSE'
  | 'TRAINER'
  | 'SUPERVISOR'
  | 'RECEPTIONIST'
  | 'SPECIALIST'
  | 'THERAPIST'
  | 'BILLER'
  | 'LAB_ATTENDANT';

type PrismaUserEntity = {
  id: string;
  username?: string | null;
  email: string;
  password?: string | null;
  role: PrismaUserRole;
  name?: string | null;
  phone?: string | null;
  department?: string | null;
  avatar?: string | null;
  [key: string]: any;
};

type PrismaUserSessionEntity = {
  id: string;
  userId?: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  lastActiveAt?: Date | null;
  isActive: boolean;
  [key: string]: any;
};

export interface SanitizedUser extends Omit<PrismaUserEntity, 'password' | 'role'> {
  role: RoleSlug;
  roleCode: PrismaUserRole;
}

export interface UpdateProfileData {
  name?: string;
  phone?: string;
  department?: string | null;
  avatar?: string | null;
}

export interface AdminUpdateUserStatusData {
  isActive: boolean;
}

export interface AuthResponse {
  user: SanitizedUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

export interface ChangePasswordData {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface SessionInfo {
  id: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastActiveAt?: Date;
  isActive: boolean;
}

export class AuthService {
  private static readonly ROLE_SLUG_MAP: Record<PrismaUserRole, RoleSlug> = {
    ADMIN: 'admin',
    APPLICANT: 'applicant',
    NURSE: 'nurse',
    TRAINER: 'trainer',
    SUPERVISOR: 'supervisor',
    BILLER: 'biller',
    RECEPTIONIST: 'receptionist',
    SPECIALIST: 'specialist',
    THERAPIST: 'therapist',
    LAB_ATTENDANT: 'lab_attendant',
  };

  /**
   * Authenticate user with username and password
   */
  static async login(credentials: LoginCredentials, deviceInfo?: any): Promise<AuthResponse> {
    const { username, password, rememberMe = false } = credentials;
    let user: any = null;

    try {
      const usernameNormalized = username.trim().toLowerCase();
      user = await prisma.user.findFirst({
        where: { username: usernameNormalized }
      });

      if (!user) {
        logger.warn('Login attempt with non-existent username', { username: usernameNormalized });
        throw new CustomError('Invalid username or password', 401);
      }

      if (!user.isActive) {
        logger.warn('Login attempt with inactive account', { username: usernameNormalized, userId: user.id });
        throw new CustomError('Account is inactive. Please contact administrator.', 401);
      }

      if (!user.password) {
        logger.warn('Login attempt for user without password', { username: usernameNormalized, userId: user.id });
        throw new CustomError('Invalid username or password', 401);
      }

      const isPasswordValid = await PasswordService.comparePassword(password, user.password);
      if (!isPasswordValid) {
        logger.warn('Login attempt with invalid password', { username: usernameNormalized, userId: user.id });
        throw new CustomError('Invalid username or password', 401);
      }

      // Update last login time
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });
      } catch (error) {
        logger.error('Failed to update last login time', { error, userId: user.id });
        throw error;
      }

      // Create session
      let sessionId: string;
      try {
        sessionId = await this.createUserSession(user.id, deviceInfo, rememberMe);
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to create user session', { 
          error: errorMsg,
          errorCode: error?.code,
          errorMeta: error?.meta,
          userId: user.id,
          stack: error instanceof Error ? error.stack : undefined
        });
        // Handle Prisma errors specifically
        if (error?.code?.startsWith('P')) {
          throw new CustomError(`Database error: ${errorMsg}`, 500);
        }
        throw error;
      }

      // Generate tokens
      let accessToken: string;
      let refreshToken: string;
      try {
        // Verify JWT secrets are configured (allow default values for local development)
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
          throw new Error('JWT_SECRET is not configured');
        }
        if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.trim() === '') {
          throw new Error('JWT_REFRESH_SECRET is not configured');
        }
        
        const tokenPayload: JWTPayload = {
          userId: user.id,
          email: user.email,
          username: user.username ?? undefined,
          role: user.role,
          sessionId
        };
        const tokens = JWTService.generateTokenPair(tokenPayload);
        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken;
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to generate tokens', { 
          error: errorMsg,
          userId: user.id,
          hasJwtSecret: !!process.env.JWT_SECRET,
          hasJwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
          stack: error instanceof Error ? error.stack : undefined
        });
        throw new CustomError(`Token generation failed: ${errorMsg}`, 500);
      }

      // Store refresh token
      try {
        await this.storeRefreshToken(user.id, refreshToken);
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to store refresh token', { 
          error: errorMsg,
          errorCode: error?.code,
          userId: user.id,
          stack: error instanceof Error ? error.stack : undefined
        });
        // Handle Prisma errors specifically
        if (error?.code?.startsWith('P')) {
          throw new CustomError(`Database error storing token: ${errorMsg}`, 500);
        }
        throw error;
      }

      // Remove password from response
      let sanitizedUser: SanitizedUser;
      try {
        sanitizedUser = this.sanitizeUser(user as any);
      } catch (error) {
        logger.error('Failed to sanitize user', { error, userId: user.id });
        throw error;
      }

      logger.info('User logged in successfully', { userId: user.id, username: user.username });

      return {
        user: sanitizedUser,
        accessToken,
        refreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      };

    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      }
      
      // Handle Prisma errors specifically
      if (error?.code?.startsWith('P')) {
        logger.error('Login failed - Prisma Database Error', { 
          prismaCode: error.code,
          prismaMessage: error.message,
          meta: error.meta,
          username: credentials?.username,
          userId: user?.id
        });
        
        // Provide more specific error messages for common Prisma errors
        if (error.code === 'P2002') {
          throw new CustomError('Database constraint violation. Please try again.', 500);
        } else if (error.code === 'P2025') {
          throw new CustomError('User record not found in database', 500);
        } else if (error.code === 'P2003') {
          throw new CustomError('Database foreign key constraint failed', 500);
        } else {
          throw new CustomError(`Database error: ${error.message || error.code}`, 500);
        }
      }
      
      // Log the actual error for debugging with full details
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : 'Unknown';
      
      // Log with full error object to see all properties
      logger.error('Login failed - Detailed Error', { 
        error: errorMessage,
        errorName: errorName,
        stack: errorStack,
        username: credentials?.username,
        errorType: error?.constructor?.name,
        fullError: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        // Check for Prisma errors
        prismaError: error?.code ? {
          code: error.code,
          meta: error.meta
        } : undefined
      });
      
      // In development, include more details in error message
      const isDevelopment = process.env.NODE_ENV === 'development';
      const detailedMessage = isDevelopment 
        ? `Login failed: ${errorMessage}` 
        : 'Login failed. Please try again.';
      
      throw new CustomError(detailedMessage, 500);
    }
  }

  /**
   * Register a new user
   */
  static async register(data: RegisterData): Promise<AuthResponse> {
    const { name, email, password, role, phone, department } = data;

    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (existingUser) {
        throw new CustomError('User with this email already exists', 409);
      }

      // Validate password strength
      const passwordValidation = PasswordService.validateRegistrationPassword(password);
      if (!passwordValidation.isValid) {
        throw new CustomError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Hash password
      const hashedPassword = await PasswordService.hashPassword(password);

      // Create user
      const resolvedRole = this.resolveRole(role);

      const user = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          role: resolvedRole as UserRole,
          phone: phone ?? null,
          department: department ?? null,
          isActive: true,
          isVerified: false
        }
      });

      // Create session
      const sessionId = await this.createUserSession(user.id);

      // Generate tokens
      const tokenPayload: JWTPayload = {
        userId: user.id,
        email: user.email ?? undefined,
        role: user.role,
        sessionId
      };

      const { accessToken, refreshToken } = JWTService.generateTokenPair(tokenPayload);

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      // Remove password from response
      const sanitizedUser = this.sanitizeUser(user as any);

      logger.info('User registered successfully', { userId: user.id, email: user.email, role: user.role });

      return {
        user: sanitizedUser,
        accessToken,
        refreshToken,
        expiresIn: 15 * 60
      };

    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Registration failed', { error, email });
      throw new CustomError('Registration failed. Please try again.', 500);
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      // Verify refresh token
      const payload = JWTService.verifyRefreshToken(refreshToken);

      // Check if refresh token exists in database
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true }
      });

      if (!storedToken) {
        logger.warn('Refresh token not found in database', { userId: payload.userId });
        throw new CustomError('Invalid refresh token', 401);
      }

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        // Clean up expired token
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new CustomError('Refresh token has expired', 401);
      }

      // Check if user is still active
      if (!storedToken.user.isActive) {
        // Clean up tokens for inactive user
        await this.cleanupUserTokens(storedToken.userId);
        throw new CustomError('Account is inactive', 401);
      }

      // Generate new access token
      const tokenPayload: JWTPayload = {
        userId: storedToken.userId,
        email: storedToken.user.email ?? undefined,
        role: storedToken.user.role
      };

      const accessToken = JWTService.generateAccessToken(tokenPayload);

      logger.info('Access token refreshed', { userId: storedToken.userId });

      return {
        accessToken,
        expiresIn: 15 * 60
      };

    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Token refresh failed', { error });
      throw new CustomError('Token refresh failed', 401);
    }
  }

  /**
   * Logout user and invalidate tokens
   */
  static async logout(userId: string, sessionId?: string): Promise<void> {
    try {
      // If sessionId is provided, revoke specific session
      if (sessionId) {
        await prisma.userSession.update({
          where: { id: sessionId },
          data: { isActive: false }
        });
      } else {
        // Revoke all user sessions
        await prisma.userSession.updateMany({
          where: { userId },
          data: { isActive: false }
        });
      }

      // Clean up refresh tokens
      await prisma.refreshToken.deleteMany({
        where: { userId }
      });

      logger.info('User logged out', { userId, sessionId });

    } catch (error) {
      logger.error('Logout failed', { error, userId });
      throw new CustomError('Logout failed', 500);
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        // Don't reveal if user exists or not for security
        logger.info('Password reset requested for non-existent email', { email });
        return;
      }

      // Generate reset token
      const resetToken = JWTService.generatePasswordResetToken(email);

      // Store reset token (you might want to create a separate table for this)
      // For now, we'll use the JWT token directly
      
      // TODO: Send email with reset token
      logger.info('Password reset token generated', { email, userId: user.id });

    } catch (error) {
      logger.error('Password reset request failed', { error, email });
      throw new CustomError('Password reset request failed', 500);
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Verify reset token
      const { email } = JWTService.verifyPasswordResetToken(token);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        throw new CustomError('Invalid reset token', 400);
      }

      // Validate new password
      const passwordValidation = PasswordService.validateRegistrationPassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new CustomError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Hash new password
      const hashedPassword = await PasswordService.hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });

      // Clean up all user sessions and tokens (force re-login)
      await this.cleanupUserTokens(user.id);

      logger.info('Password reset successfully', { userId: user.id, email });

    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Password reset failed', { error });
      throw new CustomError('Password reset failed', 500);
    }
  }

  /**
   * Change password for authenticated user
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // Check if user has a password set
      if (!user.password) {
        throw new CustomError('User account does not have a password set', 400);
      }

      // Verify current password
      const isCurrentPasswordValid = await PasswordService.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new CustomError('Current password is incorrect', 400);
      }

      // Validate new password
      const passwordValidation = PasswordService.validatePasswordChange(newPassword, currentPassword);
      if (!passwordValidation.isValid) {
        throw new CustomError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Hash new password
      const hashedPassword = await PasswordService.hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      logger.info('Password changed successfully', { userId });

    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Password change failed', { error, userId });
      throw new CustomError('Password change failed', 500);
    }
  }

  /**
   * Verify email address
   */
  static async verifyEmail(token: string): Promise<void> {
    try {
      // Verify email token
      const { email } = JWTService.verifyEmailVerificationToken(token);

      // Update user verification status
      const user = await prisma.user.update({
        where: { email },
        data: { isVerified: true }
      });

      logger.info('Email verified successfully', { userId: user.id, email });

    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Email verification failed', { error });
      throw new CustomError('Email verification failed', 400);
    }
  }

  /**
   * Resend email verification
   */
  static async resendEmailVerification(email: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        throw new CustomError('User not found', 404);
      }

      if (user.isVerified) {
        throw new CustomError('Email is already verified', 400);
      }

      // Generate verification token
      const verificationToken = JWTService.generateEmailVerificationToken(email);

      // TODO: Send verification email
      logger.info('Email verification resent', { userId: user.id, email });

    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Resend email verification failed', { error, email });
      throw new CustomError('Failed to resend verification email', 500);
    }
  }

  /**
   * Get user profile
   */
  static async getUserProfile(userId: string): Promise<SanitizedUser> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new CustomError('User not found', 404);
      }

      return this.sanitizeUser(user as any);

    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Get user profile failed', { error, userId });
      throw new CustomError('Failed to get user profile', 500);
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, data: UpdateProfileData): Promise<SanitizedUser> {
    try {
      const updateData: Record<string, unknown> = {};

      if (typeof data.name !== 'undefined') {
        updateData.name = data.name;
      }
      if (typeof data.phone !== 'undefined') {
        updateData.phone = data.phone;
      }
      if (typeof data.department !== 'undefined') {
        updateData.department = data.department;
      }
      if (typeof data.avatar !== 'undefined') {
        updateData.avatar = data.avatar;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData as any,
      });

      logger.info('User profile updated', { userId });
      return this.sanitizeUser(updatedUser as any);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Update profile failed', { error, userId });
      throw new CustomError('Failed to update profile', 500);
    }
  }

  /**
   * Get user sessions
   */
  static async getUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const sessions = await prisma.userSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return sessions.map((session: PrismaUserSessionEntity): SessionInfo => {
        const sessionInfo: SessionInfo = {
          id: session.id,
          createdAt: session.createdAt,
          isActive: session.isActive
        };

        if (session.deviceInfo) {
          sessionInfo.deviceInfo = session.deviceInfo;
        }
        if (session.ipAddress) {
          sessionInfo.ipAddress = session.ipAddress;
        }
        if (session.userAgent) {
          sessionInfo.userAgent = session.userAgent;
        }

        return sessionInfo;
      });

    } catch (error) {
      logger.error('Get user sessions failed', { error, userId });
      throw new CustomError('Failed to get user sessions', 500);
    }
  }

  /**
   * Revoke specific session
   */
  static async revokeSession(userId: string, sessionId: string): Promise<void> {
    try {
      const session = await prisma.userSession.findFirst({
        where: { id: sessionId, userId }
      });

      if (!session) {
        throw new CustomError('Session not found', 404);
      }

      await prisma.userSession.update({
        where: { id: sessionId },
        data: { isActive: false }
      });

      logger.info('Session revoked', { userId, sessionId });

    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Revoke session failed', { error, userId, sessionId });
      throw new CustomError('Failed to revoke session', 500);
    }
  }

  /**
   * Revoke all sessions
   */
  static async revokeAllSessions(userId: string): Promise<void> {
    try {
      await prisma.userSession.updateMany({
        where: { userId },
        data: { isActive: false }
      });

      await this.cleanupUserTokens(userId);

      logger.info('All sessions revoked', { userId });

    } catch (error) {
      logger.error('Revoke all sessions failed', { error, userId });
      throw new CustomError('Failed to revoke all sessions', 500);
    }
  }

  /**
   * Admin: list all users
   */
  static async getAllUsers(): Promise<SanitizedUser[]> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user: any) => this.sanitizeUser(user));
  }

  /**
   * Admin: update user active status
   */
  static async updateUserStatus(userId: string, data: AdminUpdateUserStatusData): Promise<SanitizedUser> {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive: data.isActive },
      });

      logger.info('User status updated', { userId, isActive: data.isActive });
      return this.sanitizeUser(updatedUser as any);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Update user status failed', { error, userId });
      throw new CustomError('Failed to update user status', 500);
    }
  }

  // Private helper methods

  /**
   * Create user session
   */
  private static async createUserSession(
    userId: string, 
    deviceInfo?: any, 
    rememberMe: boolean = false
  ): Promise<string> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7)); // 30 days for remember me, 7 days otherwise

      // Use substring instead of deprecated substr
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      const session = await prisma.userSession.create({
        data: {
          userId,
          token: sessionToken,
          deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
          ipAddress: deviceInfo?.ipAddress || null,
          userAgent: deviceInfo?.userAgent || null,
          expiresAt
        }
      });

      return session.id;
    } catch (error: any) {
      // Handle Prisma unique constraint errors
      if (error?.code === 'P2002') {
        // Token already exists, generate a new one and retry once
        logger.warn('Session token collision, retrying with new token', { userId });
        const retryToken = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const session = await prisma.userSession.create({
          data: {
            userId,
            token: retryToken,
            deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
            ipAddress: deviceInfo?.ipAddress || null,
            userAgent: deviceInfo?.userAgent || null,
            expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000)
          }
        });
        return session.id;
      }
      throw error;
    }
  }

  /**
   * Store refresh token
   */
  private static async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await prisma.refreshToken.create({
        data: {
          userId,
          token: refreshToken,
          expiresAt
        }
      });
    } catch (error: any) {
      // Handle Prisma unique constraint errors (token already exists - rare but possible)
      if (error?.code === 'P2002') {
        logger.warn('Refresh token collision, deleting old token and retrying', { userId });
        // Delete old token if exists and retry
        await prisma.refreshToken.deleteMany({
          where: { token: refreshToken }
        });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await prisma.refreshToken.create({
          data: {
            userId,
            token: refreshToken,
            expiresAt
          }
        });
        return;
      }
      throw error;
    }
  }

  /**
   * Clean up user tokens and sessions
   */
  private static async cleanupUserTokens(userId: string): Promise<void> {
    await Promise.all([
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.userSession.updateMany({
        where: { userId },
        data: { isActive: false }
      })
    ]);
  }

  /**
   * Enable two-factor authentication for user
   */
  static async enableTwoFactor(userId: string, password: string): Promise<{ secret: string; qrCode: string }> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // Check if user has a password set
      if (!user.password) {
        throw new CustomError('User account does not have a password set', 401);
      }

      // Verify password
      const isPasswordValid = await PasswordService.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new CustomError('Invalid password', 401);
      }

      // Generate 2FA secret (in production, use a library like speakeasy)
      const secret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const qrCode = `otpauth://totp/TeamworkHomecare:${user.email}?secret=${secret}&issuer=TeamworkHomecare`;

      // Store secret in user model or separate table (simplified - store in SystemConfig)
      await prisma.systemConfig.upsert({
        where: { key: `2fa_secret_${userId}` },
        update: { value: { secret, enabled: false } },
        create: {
          key: `2fa_secret_${userId}`,
          value: { secret, enabled: false },
          category: 'security'
        }
      });

      logger.info('2FA enabled for user', { userId });
      return { secret, qrCode };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('2FA enable failed', { error, userId });
      throw new CustomError('Failed to enable 2FA', 500);
    }
  }

  /**
   * Verify 2FA token
   */
  static async verifyTwoFactor(userId: string, token: string, backupCode?: string): Promise<boolean> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: `2fa_secret_${userId}` }
      });

      if (!config) {
        throw new CustomError('2FA not enabled', 400);
      }

      const currentValue = (config.value as Record<string, unknown>) || {};
      const secret = currentValue.secret as string | undefined;
      const enabled = (currentValue.enabled as boolean | undefined) ?? false;

      // In production, verify token using TOTP library
      // For now, simple validation (token should be 6 digits)
      if (!/^\d{6}$/.test(token)) {
        throw new CustomError('Invalid 2FA token format', 400);
      }

      // If 2FA is not yet enabled, enable it after verification
      if (!enabled) {
        await prisma.systemConfig.update({
          where: { key: `2fa_secret_${userId}` },
          data: { value: { ...currentValue, enabled: true } }
        });
      }

      logger.info('2FA verified', { userId });
      return true;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('2FA verification failed', { error, userId });
      throw new CustomError('2FA verification failed', 400);
    }
  }
  private static sanitizeUser(user: PrismaUserEntity): SanitizedUser {
    // Extract role first
    const { role } = user;
    const roleSlug = this.ROLE_SLUG_MAP[role];

    if (!roleSlug) {
      logger.warn('Encountered user with unmapped role; defaulting to admin', { userId: user.id, role });
    }

    // Build sanitized user with only safe fields (explicitly exclude password and relations)
    const sanitized: SanitizedUser = {
      id: user.id,
      username: (user as any).username ?? null,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      department: user.department ?? null,
      avatar: user.avatar ?? null,
      employeeId: user.employeeId ?? null,
      licenseNumber: user.licenseNumber ?? null,
      isActive: user.isActive ?? true,
      isVerified: user.isVerified ?? false,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      specialistSpecialization: (user as any).specialistSpecialization ?? null,
      specialistType: (user as any).specialistType ?? null,
      therapistSpecialization: (user as any).therapistSpecialization ?? null,
      role: roleSlug ?? 'admin',
      roleCode: role
    };

    return sanitized;
  }

  private static resolveRole(input: string): PrismaUserRole {
    if (!input || typeof input !== 'string') {
      throw new CustomError('Role is required', 400);
    }

    const normalizedKey = input.trim().toUpperCase().replace(/[\s-]+/g, '_');
    const validRoles = Object.keys(this.ROLE_SLUG_MAP) as PrismaUserRole[];

    if (!validRoles.includes(normalizedKey as PrismaUserRole)) {
      throw new CustomError(`Invalid role provided: ${input}`, 400);
    }

    return normalizedKey as PrismaUserRole;
  }
}

export default AuthService;
