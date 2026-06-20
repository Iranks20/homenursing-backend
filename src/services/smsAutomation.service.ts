import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import {
  AppointmentReminderTiming,
  DEFAULT_APPOINTMENT_REMINDER_TIMING,
  DEFAULT_MID_DAY_UTC_HOUR,
  parseAppointmentReminderTiming,
} from '../utils/appointmentReminderSchedule';

const SETTINGS_KEY = 'sms_automation_settings';
const SETTINGS_CATEGORY = 'sms_automation';

export interface SmsAutomationSettings {
  appointmentReminderTiming: AppointmentReminderTiming;
  birthdaySmsEnabled: boolean;
  birthdaySendHourUtc: number;
  midDayReminderHourUtc: number;
}

const DEFAULT_SETTINGS: SmsAutomationSettings = {
  appointmentReminderTiming: DEFAULT_APPOINTMENT_REMINDER_TIMING,
  birthdaySmsEnabled: true,
  birthdaySendHourUtc: DEFAULT_MID_DAY_UTC_HOUR,
  midDayReminderHourUtc: DEFAULT_MID_DAY_UTC_HOUR,
};

const clampHour = (value: number): number => {
  if (Number.isNaN(value)) return DEFAULT_MID_DAY_UTC_HOUR;
  return Math.min(23, Math.max(0, Math.floor(value)));
};

const toJsonObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

export class SmsAutomationService {
  static async getSettings(): Promise<SmsAutomationSettings> {
    const record = await prisma.systemConfig.findUnique({ where: { key: SETTINGS_KEY } });
    if (!record) return { ...DEFAULT_SETTINGS };

    const value = toJsonObject(record.value);
    return {
      appointmentReminderTiming: parseAppointmentReminderTiming(value.appointmentReminderTiming),
      birthdaySmsEnabled:
        value.birthdaySmsEnabled === undefined
          ? DEFAULT_SETTINGS.birthdaySmsEnabled
          : Boolean(value.birthdaySmsEnabled),
      birthdaySendHourUtc: clampHour(Number(value.birthdaySendHourUtc ?? DEFAULT_SETTINGS.birthdaySendHourUtc)),
      midDayReminderHourUtc: clampHour(
        Number(value.midDayReminderHourUtc ?? DEFAULT_SETTINGS.midDayReminderHourUtc)
      ),
    };
  }

  static async updateSettings(
    patch: Partial<SmsAutomationSettings>
  ): Promise<SmsAutomationSettings> {
    const current = await this.getSettings();
    const next: SmsAutomationSettings = {
      appointmentReminderTiming: patch.appointmentReminderTiming
        ? parseAppointmentReminderTiming(patch.appointmentReminderTiming)
        : current.appointmentReminderTiming,
      birthdaySmsEnabled:
        patch.birthdaySmsEnabled !== undefined ? patch.birthdaySmsEnabled : current.birthdaySmsEnabled,
      birthdaySendHourUtc:
        patch.birthdaySendHourUtc !== undefined
          ? clampHour(patch.birthdaySendHourUtc)
          : current.birthdaySendHourUtc,
      midDayReminderHourUtc:
        patch.midDayReminderHourUtc !== undefined
          ? clampHour(patch.midDayReminderHourUtc)
          : current.midDayReminderHourUtc,
    };

    await prisma.systemConfig.upsert({
      where: { key: SETTINGS_KEY },
      create: {
        key: SETTINGS_KEY,
        category: SETTINGS_CATEGORY,
        value: next as unknown as Prisma.InputJsonObject,
      },
      update: {
        value: next as unknown as Prisma.InputJsonObject,
      },
    });

    return next;
  }

  static resolveAppointmentTiming(
    override: AppointmentReminderTiming | undefined,
    settings: SmsAutomationSettings
  ): AppointmentReminderTiming {
    if (override) return parseAppointmentReminderTiming(override);
    return settings.appointmentReminderTiming;
  }
}
