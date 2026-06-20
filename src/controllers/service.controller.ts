import { Request, Response, NextFunction } from 'express';
import { ServiceService, ServiceFilters, CreateServiceData, UpdateServiceData } from '../services/service.service';
import { 
  validateBody, 
  validateQuery,
  createServiceSchema, 
  updateServiceSchema,
  searchServicesSchema,
} from '../validators/service.validator';
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

export class ServiceController {
  static async getServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<ServiceFilters>(searchServicesSchema, req.query);
      const page = parseNumber(req.query.page, filters.page ?? 1);
      const limit = parseNumber(req.query.limit, filters.limit ?? 10);
      const result = await ServiceService.getServices({ ...filters, page, limit });

      const userRole = (req as Request & { user?: { role?: string } }).user?.role;
      const isBillerOrAdmin = userRole === 'BILLER' || userRole === 'ADMIN';
      const services = isBillerOrAdmin
        ? result.services
        : (result.services as Array<Record<string, unknown>>).map((s) => {
            const { price, ...rest } = s;
            return rest;
          });

      res.status(200).json({
        success: true,
        data: services,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getServiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Service');
      const service = await ServiceService.getServiceById(id);

      if (!service) {
        throw new CustomError('Service not found', 404);
      }

      const userRole = (req as Request & { user?: { role?: string } }).user?.role;
      const isBillerOrAdmin = userRole === 'BILLER' || userRole === 'ADMIN';
      const data = isBillerOrAdmin
        ? service
        : (() => {
            const s = service as Record<string, unknown>;
            const { price, ...rest } = s;
            return rest;
          })();

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateBody<CreateServiceData>(createServiceSchema, req.body);
      const service = await ServiceService.createService(data);

      res.status(201).json({
        success: true,
        message: 'Service created successfully',
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Service');
      const data = validateBody<UpdateServiceData>(updateServiceSchema, req.body);
      const service = await ServiceService.updateService(id, data);

      res.status(200).json({
        success: true,
        message: 'Service updated successfully',
        data: service,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Service');
      await ServiceService.deleteService(id);

      res.status(200).json({
        success: true,
        message: 'Service deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

