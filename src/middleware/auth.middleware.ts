import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../utils/jwt';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from './error.middleware';

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email?: string | undefined;
        role: string;
        sessionId?: string;
      };
    }
  }
}

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new CustomError('Authorization header is required', 401);
    }

    const token = JWTService.extractTokenFromHeader(authHeader);

    // Verify access token
    const payload = JWTService.verifyAccessToken(token);

    // Check if session is still active
    if (payload.sessionId) {
      const session = await prisma.userSession.findUnique({
        where: { id: payload.sessionId },
        include: { user: true }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        logger.warn('Invalid or expired session', { sessionId: payload.sessionId, userId: payload.userId });
        throw new CustomError('Session is invalid or expired', 401);
      }

      // Check if user is still active
      if (!session.user.isActive) {
        logger.warn('User account is inactive', { userId: payload.userId });
        throw new CustomError('Account is inactive', 401);
      }
    }

    // Attach user info to request
    // Normalize role to uppercase for consistent comparison
    const normalizedRole = typeof payload.role === 'string' ? payload.role.toUpperCase() : payload.role;
    req.user = {
      userId: payload.userId,
      role: normalizedRole,
      ...(payload.email != null && payload.email !== '' ? { email: payload.email } : {}),
      ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
    };

    next();

  } catch (error) {
    if (error instanceof CustomError) {
      next(error);
    } else {
      const err = toError(error);
      logger.error('Authentication failed', { error: err.message });
      next(new CustomError('Authentication failed', 401));
    }
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }

    const token = JWTService.extractTokenFromHeader(authHeader);
    const payload = JWTService.verifyAccessToken(token);

    // Check session if sessionId exists
    if (payload.sessionId) {
      const session = await prisma.userSession.findUnique({
        where: { id: payload.sessionId },
        include: { user: true }
      });

      if (session && session.isActive && session.expiresAt > new Date() && session.user.isActive) {
        req.user = {
          userId: payload.userId,
          role: payload.role,
          ...(payload.email != null && payload.email !== '' ? { email: payload.email } : {}),
          ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
        };
      }
    }

    next();

  } catch (error) {
    // For optional auth, we just continue without setting user
    next();
  }
};

/**
 * Authorization middleware - checks user roles
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new CustomError('Authentication required', 401);
    }

    // Normalize roles to uppercase for consistent comparison
    const userRole = req.user.role?.toUpperCase();
    const normalizedAllowedRoles = allowedRoles.map(role => role.toUpperCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      logger.warn('Access denied - insufficient permissions', { 
        userId: req.user.userId, 
        userRole: req.user.role, 
        requiredRoles: allowedRoles 
      });
      throw new CustomError('Access denied - insufficient permissions', 403);
    }

    next();
  };
};

/**
 * Admin only middleware
 */
export const requireAdmin = authorize('ADMIN');

/**
 * Require user to be Admin or Biller
 */
export const requireAdminOrBiller = authorize('ADMIN', 'BILLER');

/**
 * Staff only middleware (all roles - no patients in this system)
 */
export const requireStaff = authorize(
  'ADMIN',
  'RECEPTIONIST',
  'DOCTOR',
  'SPECIALIST',
  'THERAPIST',
  'NURSE',
  'SUPERVISOR'
);

/**
 * Medical staff only middleware (Specialists, Therapists, Nurses)
 */
export const requireMedicalStaff = authorize(
  'ADMIN',
  'SPECIALIST',
  'THERAPIST',
  'NURSE'
);

/**
 * Specialists and Therapists only middleware
 */
export const requireSpecialistsAndTherapists = authorize(
  'ADMIN',
  'SPECIALIST',
  'THERAPIST'
);

/**
 * Receptionist and Admin only middleware
 */
export const requireReceptionistOrAdmin = authorize(
  'ADMIN',
  'RECEPTIONIST'
);

/**
 * Receptionist, Admin, or Biller - for listing users (billers restricted to role=biller in controller)
 */
export const requireReceptionistAdminOrBiller = authorize(
  'ADMIN',
  'RECEPTIONIST',
  'BILLER'
);

/**
 * Generic role-based middleware helper
 */
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return authorize(...allowedRoles);
};

/**
 * Resource ownership middleware - checks if user owns the resource
 */
export const requireOwnership = (resourceUserIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new CustomError('Authentication required', 401);
    }

    // Admin can access any resource
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (!resourceUserId) {
      throw new CustomError('Resource user ID not found', 400);
    }

    if (req.user.userId !== resourceUserId) {
      logger.warn('Access denied - resource ownership required', { 
        userId: req.user.userId, 
        resourceUserId 
      });
      throw new CustomError('Access denied - you can only access your own resources', 403);
    }

    next();
  };
};

/**
 * Self or admin access middleware
 */
export const requireSelfOrAdmin = (resourceUserIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new CustomError('Authentication required', 401);
    }

    // Admin can access any resource
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if user is accessing their own resource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (!resourceUserId) {
      throw new CustomError('Resource user ID not found', 400);
    }

    if (req.user.userId !== resourceUserId) {
      logger.warn('Access denied - self or admin access required', { 
        userId: req.user.userId, 
        resourceUserId 
      });
      throw new CustomError('Access denied - you can only access your own resources', 403);
    }

    next();
  };
};

/**
 * Email verification required middleware
 */
export const requireEmailVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new CustomError('Authentication required', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    if (!user.isVerified) {
      throw new CustomError('Email verification required', 403);
    }

    next();

  } catch (error) {
    if (error instanceof CustomError) {
      next(error);
    } else {
      const err = toError(error);
      logger.error('Email verification check failed', { error: err.message, userId: req.user?.userId });
      next(new CustomError('Failed to verify email status', 500));
    }
  }
};

/**
 * Rate limiting middleware for auth endpoints
 */
export const authRateLimit = {
  login: 5, // 5 attempts per window
  register: 3, // 3 attempts per window
  forgotPassword: 3, // 3 attempts per window
  resetPassword: 5, // 5 attempts per window
  changePassword: 3, // 3 attempts per window
  refresh: 10 // 10 attempts per window
};

/**
 * Log authentication events
 */
export const logAuthEvent = (event: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const logData = {
      event,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId,
      email: req.user?.email,
      timestamp: new Date().toISOString()
    };

    logger.info('Authentication event', logData);
    next();
  };
};

export default {
  authenticate,
  optionalAuth,
  authorize,
  requireAdmin,
  requireStaff,
  requireMedicalStaff,
  requireSpecialistsAndTherapists,
  requireReceptionistOrAdmin,
  requireAdminOrBiller,
  requireRole,
  requireOwnership,
  requireSelfOrAdmin,
  requireEmailVerification,
  logAuthEvent
};
