import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ENV_CONFIG } from '../config/environment';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }
  
  return log;
});

// Create logger instance
export const logger = winston.createLogger({
  level: ENV_CONFIG.LOG_LEVEL,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'teamwork-homecare-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      ),
    }),

    // File transport for all logs (only in production or if logs directory exists)
    ...(ENV_CONFIG.NODE_ENV === 'production' ? [
      new DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: combine(
          timestamp(),
          errors({ stack: true }),
          json()
        ),
      }),
      // File transport for error logs only
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: combine(
          timestamp(),
          errors({ stack: true }),
          json()
        ),
      }),
    ] : []),
  ],
});

// Create a stream object for Morgan HTTP logger
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Log uncaught exceptions (only if logs directory exists)
try {
  const fs = require('fs');
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
  }
  logger.exceptions.handle(
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  );
  
  // Log unhandled promise rejections
  logger.rejections.handle(
    new winston.transports.File({ filename: 'logs/rejections.log' })
  );
} catch (error) {
  // Log directory creation failed, continue without file logging for exceptions
  console.warn('⚠️ Could not set up exception logging files:', error);
}

export default logger;
