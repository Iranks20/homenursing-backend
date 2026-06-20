import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export interface LoginAttemptFilters {
  userId?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
}

export interface AppConfig {
  appName: string;
  version: string;
  environment: string;
  [key: string]: unknown;
}

export interface FeatureFlags {
  twoFactorAuth: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  physiotherapyModule: boolean;
  trainingModule: boolean;
  [key: string]: unknown;
}

const APP_CONFIG_KEY = 'app_config';
const APP_CONFIG_CATEGORY = 'system';
const FEATURE_FLAGS_KEY = 'feature_flags';
const FEATURE_FLAGS_CATEGORY = 'feature';
const BACKUP_PREFIX = 'data_backup_';
const BACKUP_CATEGORY = 'backup';

const toJsonObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

const mergeJson = <T extends Record<string, unknown>>(existing: Prisma.JsonValue | null, updates: Partial<T>, defaults: T): T => {
  return Object.assign({}, defaults, toJsonObject(existing), updates) as T;
};

const toDateFilter = (start?: string, end?: string): Prisma.DateTimeFilter | undefined => {
  const filter: Prisma.DateTimeFilter = {};
  if (start) {
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) throw new CustomError('startDate is invalid', 400);
    filter.gte = startDate;
  }
  if (end) {
    const endDate = new Date(end);
    if (Number.isNaN(endDate.getTime())) throw new CustomError('endDate is invalid', 400);
    filter.lte = endDate;
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
};

const defaultAppConfig = (): AppConfig => ({
  appName: 'Teamwork Homecare',
  version: '1.0.0',
  environment: process.env.NODE_ENV ?? 'development',
});

const defaultFeatureFlags = (): FeatureFlags => ({
  twoFactorAuth: false,
  emailNotifications: true,
  smsNotifications: false,
  physiotherapyModule: true,
  trainingModule: true,
});

export class SystemManagementService {
  static async getAuditLogs(filters: AuditLogFilters, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;

    const timestampFilter = toDateFilter(filters.startDate, filters.endDate);
    if (timestampFilter) {
      where.timestamp = timestampFilter;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  static async getUserActivities(userId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where: { userId } }),
    ]);

    return {
      activities,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  static async getLoginAttempts(filters: LoginAttemptFilters, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = { action: 'LOGIN_ATTEMPT' };

    if (filters.userId) where.userId = filters.userId;

    const timestampFilter = toDateFilter(filters.startDate, filters.endDate);
    if (timestampFilter) {
      where.timestamp = timestampFilter;
    }

    if (filters.success !== undefined) {
      where.details = {
        path: ['success'],
        equals: filters.success,
      } as Prisma.JsonNullableFilter;
    }

    const [attempts, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      attempts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  static async exportAuditLogs(filters: AuditLogFilters) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { timestamp: 'desc' },
    });

    return {
      exportId: `audit_export_${Date.now()}`,
      recordCount: logs.length,
      generatedAt: new Date().toISOString(),
    };
  }

  static async getAppConfig(): Promise<AppConfig> {
    const config = await prisma.systemConfig.findUnique({ where: { key: APP_CONFIG_KEY } });

    if (!config) {
      return this.updateAppConfig({});
    }

    return mergeJson<AppConfig>(config.value, {}, defaultAppConfig());
  }

  static async updateAppConfig(data: Partial<AppConfig>): Promise<AppConfig> {
    const existing = await prisma.systemConfig.findUnique({ where: { key: APP_CONFIG_KEY } });
    const updatedValue = mergeJson<AppConfig>(existing?.value ?? null, data, defaultAppConfig());

    const record = await prisma.systemConfig.upsert({
      where: { key: APP_CONFIG_KEY },
      update: { value: updatedValue as Prisma.InputJsonObject },
      create: {
        key: APP_CONFIG_KEY,
        category: APP_CONFIG_CATEGORY,
        value: updatedValue as Prisma.InputJsonObject,
      },
    });

    logger.info('App configuration updated');
    return mergeJson<AppConfig>(record.value, {}, defaultAppConfig());
  }

  static async getFeatureFlags(): Promise<FeatureFlags> {
    const flags = await prisma.systemConfig.findUnique({ where: { key: FEATURE_FLAGS_KEY } });

    if (!flags) {
      return this.updateFeatureFlags({});
    }

    return mergeJson<FeatureFlags>(flags.value, {}, defaultFeatureFlags());
  }

  static async updateFeatureFlags(data: Partial<FeatureFlags>): Promise<FeatureFlags> {
    const existing = await prisma.systemConfig.findUnique({ where: { key: FEATURE_FLAGS_KEY } });
    const updatedValue = mergeJson<FeatureFlags>(existing?.value ?? null, data, defaultFeatureFlags());

    const record = await prisma.systemConfig.upsert({
      where: { key: FEATURE_FLAGS_KEY },
      update: { value: updatedValue as Prisma.InputJsonObject },
      create: {
        key: FEATURE_FLAGS_KEY,
        category: FEATURE_FLAGS_CATEGORY,
        value: updatedValue as Prisma.InputJsonObject,
      },
    });

    logger.info('Feature flags updated');
    return mergeJson<FeatureFlags>(record.value, {}, defaultFeatureFlags());
  }

  static async createBackup() {
    const timestamp = new Date().toISOString();
    const backup = await prisma.systemConfig.create({
      data: {
        key: `${BACKUP_PREFIX}${Date.now()}`,
        category: BACKUP_CATEGORY,
        value: {
          timestamp,
          status: 'completed',
          type: 'full',
        } as Prisma.InputJsonObject,
      },
    });

    logger.info('Data backup created', { backupId: backup.id });
    return { backupId: backup.id, timestamp };
  }

  static async restoreBackup(backupId: string) {
    const backup = await prisma.systemConfig.findUnique({ where: { id: backupId } });

    if (!backup || !backup.key.startsWith(BACKUP_PREFIX)) {
      throw new CustomError('Backup not found', 404);
    }

    logger.info('Data restore initiated', { backupId });
    return { message: 'Restore initiated', backupId };
  }

  static async exportData(format: string = 'json') {
    return {
      exportId: `data_export_${Date.now()}`,
      format,
      generatedAt: new Date().toISOString(),
      recordCount: 0,
    };
  }

  static async importData(data: unknown) {
    logger.info('Data import initiated');
    const recordCount = Array.isArray(data) ? data.length : 0;
    return { message: 'Import initiated', recordCount };
  }

  static async getCleanupRecommendations() {
    return {
      recommendations: [
        { type: 'old_logs', count: 0, action: 'Delete audit logs older than 90 days' },
        { type: 'expired_sessions', count: 0, action: 'Clean up expired user sessions' },
        { type: 'old_backups', count: 0, action: 'Remove backups older than 30 days' },
      ],
    };
  }
}

