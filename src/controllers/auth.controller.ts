import { Request, Response, NextFunction } from 'express';
import { AuthService, LoginCredentials, RegisterData } from '../services/auth.service';
import { 
  validateBody, 
  loginSchema, 
  registerSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshTokenSchema,
  revokeSessionSchema,
  revokeAllSessionsSchema,
  updateProfileSchema,
  updateUserStatusSchema
} from '../validators/auth.validator';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export class AuthController {
  /**
   * User login
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const credentials = validateBody(loginSchema, req.body);
      
      // Extract device information
      const deviceInfo = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        ...credentials
      };

      const result = await AuthService.login(credentials, deviceInfo);

      logger.info('Login successful', { 
        userId: result.user.id, 
        username: result.user.username ?? result.user.email,
        ipAddress: deviceInfo.ipAddress 
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * User registration
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateBody(registerSchema, req.body);
      
      // Extract device information
      const deviceInfo = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      const result = await AuthService.register(data);

      logger.info('Registration successful', { 
        userId: result.user.id, 
        email: result.user.email,
        role: result.user.role,
        ipAddress: deviceInfo.ipAddress 
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: result
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = validateBody(refreshTokenSchema, req.body);

      const result = await AuthService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * User logout
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const sessionId = req.user?.sessionId;

      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      await AuthService.logout(userId, sessionId);

      logger.info('Logout successful', { userId, sessionId });

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = validateBody(forgotPasswordSchema, req.body);

      await AuthService.requestPasswordReset(email);

      // Always return success for security (don't reveal if email exists)
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = validateBody(resetPasswordSchema, req.body);

      await AuthService.resetPassword(token, password);

      logger.info('Password reset successful', { ipAddress: req.ip });

      res.status(200).json({
        success: true,
        message: 'Password reset successful'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password (authenticated user)
   * POST /api/v1/auth/change-password
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const { currentPassword, newPassword } = validateBody(changePasswordSchema, req.body);

      await AuthService.changePassword(userId, currentPassword, newPassword);

      logger.info('Password changed successfully', { userId });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email address
   * POST /api/v1/auth/verify-email
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = validateBody(verifyEmailSchema, req.body);

      await AuthService.verifyEmail(token);

      res.status(200).json({
        success: true,
        message: 'Email verified successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend email verification
   * POST /api/v1/auth/resend-verification
   */
  static async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = validateBody(resendVerificationSchema, req.body);

      await AuthService.resendEmailVerification(email);

      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const user = await AuthService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: { user }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   * PUT /api/v1/auth/profile
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const updateData = validateBody(updateProfileSchema, req.body);
      const updatedUser = await AuthService.updateProfile(userId, updateData);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user sessions
   * GET /api/v1/auth/sessions
   */
  static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      const sessions = await AuthService.getUserSessions(userId);

      res.status(200).json({
        success: true,
        message: 'Sessions retrieved successfully',
        data: { sessions }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke specific session
   * DELETE /api/v1/auth/sessions/:sessionId
   */
  static async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { sessionId } = req.params;
      
      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      if (!sessionId) {
        throw new CustomError('Session ID is required', 400);
      }

      await AuthService.revokeSession(userId, sessionId);

      logger.info('Session revoked', { userId, sessionId });

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke all sessions
   * DELETE /api/v1/auth/sessions
   */
  static async revokeAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      await AuthService.revokeAllSessions(userId);

      logger.info('All sessions revoked', { userId });

      res.status(200).json({
        success: true,
        message: 'All sessions revoked successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: list all users
   */
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await AuthService.getAllUsers();
      res.status(200).json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: update user active status
   */
  static async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      if (!userId) {
        throw new CustomError('User ID is required', 400);
      }
      const { isActive } = validateBody(updateUserStatusSchema, req.body);

      const updatedUser = await AuthService.updateUserStatus(userId, { isActive });

      res.status(200).json({
        success: true,
        message: `User status updated to ${isActive ? 'active' : 'inactive'}`,
        data: { user: updatedUser },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check authentication status
   * GET /api/v1/auth/status
   */
  static async checkStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
        return;
      }

      const user = await AuthService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        message: 'Authentication status checked',
        data: { 
          isAuthenticated: true,
          user 
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Enable 2FA for user
   * POST /api/v1/auth/2fa/enable
   */
  static async enableTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { password } = validateBody(require('../validators/auth.validator').enableTwoFactorSchema, req.body);
      
      const result = await AuthService.enableTwoFactor(userId, password);

      logger.info('2FA enabled', { userId });

      res.status(200).json({
        success: true,
        message: '2FA enabled successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify 2FA token
   * POST /api/v1/auth/2fa/verify
   */
  static async verifyTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { token, backupCode } = validateBody(require('../validators/auth.validator').verifyTwoFactorSchema, req.body);
      
      const verified = await AuthService.verifyTwoFactor(userId, token, backupCode);

      logger.info('2FA verified', { userId });

      res.status(200).json({
        success: true,
        message: '2FA verified successfully',
        data: { verified }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
