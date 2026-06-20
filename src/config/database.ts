import { PrismaClient } from '@prisma/client';
import { ENV_CONFIG } from './environment';
import { logger } from '../utils/logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: ENV_CONFIG.DATABASE_URL,
      },
    },
    log: ENV_CONFIG.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

export const prisma = globalThis.__prisma || createPrismaClient();

if (ENV_CONFIG.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    const err = error as Error;
    logger.error('❌ Database connection failed', {
      message: err.message,
      stack: err.stack,
      databaseUrl: ENV_CONFIG.DATABASE_URL,
    });
    process.exit(1);
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
};

export default prisma;
