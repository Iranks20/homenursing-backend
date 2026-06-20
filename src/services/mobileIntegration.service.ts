import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface MobileConfig {
  appVersion: string;
  minAppVersion: string;
  apiUrl: string;
  enablePushNotifications: boolean;
  enableOfflineMode: boolean;
  syncInterval: number;
  [key: string]: unknown;
}

export interface PushTokenRecord {
  id: string;
  userId: string;
  token: string;
  platform: string;
  registeredAt: string;
  active: boolean;
}

export interface IntegrationRecord {
  id: string;
  integrationId: string;
  connected: boolean;
  connectedAt: string;
}

const MOBILE_CONFIG_KEY = 'mobile_config';
const MOBILE_CONFIG_CATEGORY = 'mobile';
const PUSH_TOKEN_CATEGORY = 'mobile_push_token';
const INTEGRATION_CATEGORY = 'integration';
const WEBHOOK_CATEGORY = 'integration_webhook';

const defaultMobileConfig = (): MobileConfig => ({
  appVersion: '1.0.0',
  minAppVersion: '1.0.0',
  apiUrl: process.env.API_URL ?? 'http://51.20.55.20:3007/api',
  enablePushNotifications: true,
  enableOfflineMode: true,
  syncInterval: 300,
});

const toJsonObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

const mergeConfig = (existing: Prisma.JsonValue | null, updates: Partial<MobileConfig>): MobileConfig => {
  return Object.assign({}, defaultMobileConfig(), toJsonObject(existing), updates) as MobileConfig;
};

export class MobileIntegrationService {
  static async getMobileConfig(): Promise<MobileConfig> {
    const config = await prisma.systemConfig.findUnique({ where: { key: MOBILE_CONFIG_KEY } });

    if (!config) {
      return this.updateMobileConfig({});
    }

    return mergeConfig(config.value, {});
  }

  static async updateMobileConfig(updates: Partial<MobileConfig>): Promise<MobileConfig> {
    const existing = await prisma.systemConfig.findUnique({ where: { key: MOBILE_CONFIG_KEY } });
    const value = mergeConfig(existing?.value ?? null, updates);

    const record = await prisma.systemConfig.upsert({
      where: { key: MOBILE_CONFIG_KEY },
      update: { value: value as Prisma.InputJsonObject },
      create: {
        key: MOBILE_CONFIG_KEY,
        category: MOBILE_CONFIG_CATEGORY,
        value: value as Prisma.InputJsonObject,
      },
    });

    logger.info('Mobile config updated');
    return mergeConfig(record.value, {});
  }

  static async registerPushToken(userId: string | undefined, token: string, platform: string): Promise<PushTokenRecord> {
    if (!userId) {
      throw new CustomError('User ID is required', 400);
    }

    const record = await prisma.systemConfig.create({
      data: {
        key: `push_token_${userId}_${Date.now()}`,
        category: PUSH_TOKEN_CATEGORY,
        value: {
          userId,
          token,
          platform,
          registeredAt: new Date().toISOString(),
          active: true,
        } as Prisma.InputJsonObject,
      },
    });

    logger.info('Push token registered', { userId, platform });

    const value = toJsonObject(record.value);

    return {
      id: record.id,
      userId,
      token,
      platform,
      registeredAt: String(value.registeredAt ?? new Date().toISOString()),
      active: Boolean(value.active ?? true),
    };
  }

  static async getOfflineSyncData(userId: string | undefined, lastSync?: Date) {
    if (!userId) {
      throw new CustomError('User ID is required', 400);
    }

    const patientWhere: Prisma.PatientWhereInput = {};
    const appointmentWhere: Prisma.AppointmentWhereInput = {};
    const notificationWhere: Prisma.NotificationWhereInput = { userId };

    if (lastSync) {
      patientWhere.updatedAt = { gte: lastSync };
      appointmentWhere.updatedAt = { gte: lastSync };
      notificationWhere.createdAt = { gte: lastSync };
    }

    const [patients, appointments, notifications] = await Promise.all([
      prisma.patient.findMany({
        where: patientWhere,
        take: 100,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.appointment.findMany({
        where: appointmentWhere,
        take: 100,
        orderBy: { updatedAt: 'desc' },
        include: { patient: true, service: true },
      }),
      prisma.notification.findMany({
        where: notificationWhere,
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      patients,
      appointments,
      notifications,
      syncTimestamp: new Date().toISOString(),
    };
  }

  static async getAvailableIntegrations() {
    return [
      { id: 'twilio', name: 'Twilio', type: 'sms', status: 'available' },
      { id: 'stripe', name: 'Stripe', type: 'payment', status: 'available' },
      { id: 'sendgrid', name: 'SendGrid', type: 'email', status: 'available' },
      { id: 'slack', name: 'Slack', type: 'notification', status: 'available' },
    ];
  }

  static async connectIntegration(integrationId: string, credentials: unknown): Promise<IntegrationRecord> {
    if (!integrationId) {
      throw new CustomError('Integration ID is required', 400);
    }

    const record = await prisma.systemConfig.upsert({
      where: { key: `integration_${integrationId}` },
      update: {
        value: {
          integrationId,
          connected: true,
          connectedAt: new Date().toISOString(),
          credentials: { masked: '****' },
        } as Prisma.InputJsonObject,
      },
      create: {
        key: `integration_${integrationId}`,
        category: INTEGRATION_CATEGORY,
        value: {
          integrationId,
          connected: true,
          connectedAt: new Date().toISOString(),
          credentials: { masked: '****' },
        } as Prisma.InputJsonObject,
      },
    });

    logger.info('Integration connected', { integrationId });

    const value = toJsonObject(record.value);
    return {
      id: record.id,
      integrationId: String(value.integrationId ?? integrationId),
      connected: Boolean(value.connected),
      connectedAt: String(value.connectedAt ?? new Date().toISOString()),
    };
  }

  static async handleWebhook(integrationId: string, payload: unknown) {
    if (!integrationId) {
      throw new CustomError('Integration ID is required', 400);
    }

    const record = await prisma.systemConfig.create({
      data: {
        key: `webhook_${integrationId}_${Date.now()}`,
        category: WEBHOOK_CATEGORY,
        value: {
          integrationId,
          payload,
          receivedAt: new Date().toISOString(),
          processed: false,
        } as Prisma.InputJsonObject,
      },
    });

    logger.info('Webhook received', { integrationId, webhookId: record.id });
    return { webhookId: record.id, status: 'received' };
  }
}

