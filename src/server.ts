process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err?.message, err?.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('unhandledRejection', String(reason));
  process.exit(1);
});

import app from './app';
import { ENV_CONFIG } from './config/environment';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

const maskDatabaseUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return url;
  }
};

const startServer = async () => {
  try {
    // Connect to database
    logger.info('Attempting database connection', {
      databaseUrl: maskDatabaseUrl(ENV_CONFIG.DATABASE_URL),
    });
    await connectDatabase();
    logger.info('Database connection established');

    const server = app.listen(ENV_CONFIG.PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${ENV_CONFIG.PORT}`);
      logger.info(`📊 Environment: ${ENV_CONFIG.NODE_ENV}`);
      logger.info(`🔗 API URL: http://localhost:${ENV_CONFIG.PORT}/api`);
      logger.info(`📖 Health Check: http://localhost:${ENV_CONFIG.PORT}/health`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof ENV_CONFIG.PORT === 'string'
        ? 'Pipe ' + ENV_CONFIG.PORT
        : 'Port ' + ENV_CONFIG.PORT;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
        default:
          throw error;
      }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    const err = error as Error;
    console.error('Failed to start server', err?.message, err?.stack);
    logger.error('Failed to start server', {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
};

startServer();
