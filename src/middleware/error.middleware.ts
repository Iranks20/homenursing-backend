import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Handle ValidationError specifically - check for validation error marker or details property
  if ((error as any).isValidationError || (error as any).details) {
    const validationDetails = (error as any).details || [];
    const statusCode = error.statusCode || 400;
    const errorMessage = error.message || 'Validation failed';
    
    logger.error({
      message: errorMessage,
      statusCode,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      validationDetails,
      errorName: 'ValidationError'
    });

    const errorResponse: any = {
      success: false,
      error: {
        message: errorMessage,
        details: {
          statusCode,
          name: 'ValidationError',
          ...(validationDetails.length > 0 && { validationErrors: validationDetails })
        }
      },
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
    };

    res.status(statusCode).json(errorResponse);
    return;
  }

  const { statusCode = 500, message, stack } = error;

  // Check if it's a Prisma error
  const prismaError = (error as any)?.code?.startsWith('P') ? {
    code: (error as any).code,
    meta: (error as any).meta
  } : undefined;

  // Log error details with Prisma error info if present
  logger.error({
    message,
    statusCode,
    stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    prismaError,
    errorName: error.name,
    errorType: error?.constructor?.name
  });

  // Don't leak error details in production, but show more in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse: any = {
    success: false,
    error: {
      message: isDevelopment ? message : (statusCode === 500 ? 'Internal Server Error' : message),
      ...(isDevelopment && { 
        stack,
        details: {
          statusCode,
          isOperational: error.isOperational,
          name: error.name,
          ...(prismaError && { prismaError })
        }
      }),
    },
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
  };

  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Handle specific error types
export const handlePrismaError = (error: any): CustomError => {
  if (error.code === 'P2002') {
    return new CustomError('Duplicate field value', 400);
  }
  if (error.code === 'P2025') {
    return new CustomError('Record not found', 404);
  }
  if (error.code === 'P2003') {
    return new CustomError('Foreign key constraint failed', 400);
  }
  
  return new CustomError('Database operation failed', 500);
};

export const handleValidationError = (error: any): CustomError => {
  const message = Object.values(error.errors).map((val: any) => val.message).join(', ');
  return new CustomError(message, 400);
};

export const handleJWTError = (): CustomError => {
  return new CustomError('Invalid token. Please log in again!', 401);
};

export const handleJWTExpiredError = (): CustomError => {
  return new CustomError('Your token has expired! Please log in again.', 401);
};

export default errorHandler;
