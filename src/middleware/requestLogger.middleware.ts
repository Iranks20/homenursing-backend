import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request details
  logger.info({
    type: 'request',
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Override res.end to log response details
  const originalEnd = res.end.bind(res);
  const patchedEnd: typeof res.end = function(this: Response, chunk?: any, encoding?: any, callback?: any) {
    const duration = Date.now() - startTime;
    
    logger.info({
      type: 'response',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    // Call original end method
    return originalEnd(chunk, encoding as any, callback);
  };
  res.end = patchedEnd;

  next();
};

export default requestLogger;
