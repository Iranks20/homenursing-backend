import { Request, Response, NextFunction } from 'express';
import { UserService, CreateUserData, UpdateUserData, UserFilters } from '../services/user.service';
import { 
  validateBody, 
  validateQuery,
  createUserSchema, 
  updateUserSchema,
  updateUserStatusSchema,
  searchUsersSchema,
  updateProfileSchema,
} from '../validators/user.validator';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireParamId = (id: string | undefined, resource: string): string => {
  if (!id) {
    throw new CustomError(`${resource} ID is required`, 400);
  }
  return id;
};

const requireAuthUserId = (req: Request): string => {
  const user = (req as Request & { user?: { id?: string; userId?: string } }).user;
  const userId = user?.id ?? user?.userId;
  if (!userId) {
    throw new CustomError('Unauthorized', 401);
  }
  return userId;
};

export class UserController {
  /**
   * Get all users
   * GET /api/v1/users
   */
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<UserFilters>(searchUsersSchema, req.query);
      const userRole = (req as Request & { user?: { role?: string } }).user?.role;
      // Billers may only list users with role=biller, unless explicitly requesting SPECIALIST/THERAPIST for rates management
      if (userRole === 'BILLER' && (!filters.role || filters.role === 'BILLER')) {
        filters.role = 'BILLER';
      }
      const result = await UserService.getUsers(filters);
      const isBillerOrAdmin = userRole === 'BILLER' || userRole === 'ADMIN';
      const users = isBillerOrAdmin
        ? result.users
        : (result.users as Array<Record<string, unknown>>).map((u) => {
            const { consultationFee, ...rest } = u;
            return rest;
          });

      res.status(200).json({
        success: true,
        data: users,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get doctors, specialists, and nurses (accessible by medical staff)
   * GET /api/v1/users/medical-staff
   */
  static async getMedicalStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.query.role as string | undefined;
      const limit = parseNumber(req.query.limit, 500);
      const page = parseNumber(req.query.page, 1);

      // Allow SPECIALIST, THERAPIST, or NURSE roles
      if (role && !['SPECIALIST', 'THERAPIST', 'NURSE'].includes(role.toUpperCase())) {
        throw new CustomError('Invalid role. Only SPECIALIST, THERAPIST, or NURSE allowed', 400);
      }

      const filters: UserFilters = {
        ...(role && { role: role.toUpperCase() as 'SPECIALIST' | 'THERAPIST' | 'NURSE' }),
        limit,
        page,
      };

      const result = await UserService.getUsers(filters);
      const userRole = (req as Request & { user?: { role?: string } }).user?.role;
      const isBillerOrAdmin = userRole === 'BILLER' || userRole === 'ADMIN';
      const users = isBillerOrAdmin
        ? result.users
        : (result.users as Array<Record<string, unknown>>).map((u) => {
            const { consultationFee, ...rest } = u;
            return rest;
          });

      res.status(200).json({
        success: true,
        data: users,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID
   * GET /api/v1/users/:id
   */
  static async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'User');
      const user = await UserService.getUserById(id);

      if (!user) {
        throw new CustomError('User not found', 404);
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new user
   * POST /api/v1/users
   */
  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateBody<CreateUserData>(createUserSchema, req.body);
      const user = await UserService.createUser(data);

      logger.info('User created', { userId: user.id, email: user.email });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user
   * PUT /api/v1/users/:id
   */
  static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'User');
      const body = validateBody<UpdateUserData>(updateUserSchema, req.body);
      const userRole = (req as Request & { user?: { role?: string } }).user?.role;
      const isBillerOrAdmin = userRole === 'BILLER' || userRole === 'ADMIN';

      if (body.consultationFee !== undefined) {
        if (!isBillerOrAdmin) {
          throw new CustomError('Only billers and admins can set consultation fees', 403);
        }
        const existing = await UserService.getUserById(id);
        if (!existing) throw new CustomError('User not found', 404);
        const targetRole = (existing as { role?: string }).role?.toUpperCase();
        if (targetRole !== 'SPECIALIST' && targetRole !== 'THERAPIST') {
          throw new CustomError('Consultation fee can only be set for specialists and therapists', 400);
        }
      }

      // Billers may only update consultationFee; admins may update any field
      const dataToUpdate: UpdateUserData = userRole === 'BILLER'
        ? (body.consultationFee !== undefined ? { consultationFee: body.consultationFee } : {})
        : body;

      const user = await UserService.updateUser(id, dataToUpdate);

      const data = isBillerOrAdmin
        ? user
        : (() => {
            const u = user as Record<string, unknown>;
            const { consultationFee, ...rest } = u;
            return rest;
          })();

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user status
   * PATCH /api/v1/users/:id/status
   */
  static async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'User');
      const { isActive } = validateBody<{ isActive: boolean }>(updateUserStatusSchema, req.body);
      const user = await UserService.updateUserStatus(id, isActive);

      res.status(200).json({
        success: true,
        message: 'User status updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user
   * DELETE /api/v1/users/:id
   */
  static async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'User');
      await UserService.deleteUser(id);

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/users/profile
   */
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireAuthUserId(req);

      const user = await UserService.getCurrentUserProfile(userId);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user profile
   * PUT /api/v1/users/profile
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireAuthUserId(req);

      const data = validateBody<UpdateUserData>(updateProfileSchema, req.body);
      const user = await UserService.updateCurrentUserProfile(userId, data);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload user avatar
   * POST /api/v1/users/avatar
   */
  static async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireAuthUserId(req);

      // TODO: Implement file upload logic
      res.status(200).json({
        success: true,
        message: 'Avatar upload endpoint - implementation pending',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user avatar
   * DELETE /api/v1/users/avatar
   */
  static async deleteAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireAuthUserId(req);

      await UserService.updateUser(userId, { avatar: null });

      res.status(200).json({
        success: true,
        message: 'Avatar removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search users
   * GET /api/v1/users/search
   */
  static async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<UserFilters>(searchUsersSchema, req.query);
      const result = await UserService.searchUsers(filters);

      res.status(200).json({
        success: true,
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user activity log
   * GET /api/v1/users/:id/activity
   */
  static async getUserActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'User');
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);

      const result = await UserService.getUserActivity(id, page, limit);

      res.status(200).json({
        success: true,
        data: result.activities,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

