import { parseAppointmentReminderTiming } from '../../utils/appointmentReminderSchedule';
import { SmsAutomationService } from '../smsAutomation.service';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

import prisma from '../../config/database';

const mockedPrisma = prisma as unknown as {
  systemConfig: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
};

describe('SmsAutomationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.systemConfig.findUnique.mockResolvedValue(null);
  });

  it('returns defaults when no settings are stored', async () => {
    const settings = await SmsAutomationService.getSettings();
    expect(settings.appointmentReminderTiming).toBe('MID_DAY_BEFORE');
    expect(settings.birthdaySmsEnabled).toBe(true);
    expect(settings.birthdaySendHourUtc).toBe(12);
  });

  it('persists updated settings', async () => {
    mockedPrisma.systemConfig.upsert.mockResolvedValue({});
    const updated = await SmsAutomationService.updateSettings({
      appointmentReminderTiming: 'TWENTY_FOUR_HOURS_BEFORE',
      birthdaySmsEnabled: false,
    });
    expect(updated.appointmentReminderTiming).toBe('TWENTY_FOUR_HOURS_BEFORE');
    expect(updated.birthdaySmsEnabled).toBe(false);
    expect(mockedPrisma.systemConfig.upsert).toHaveBeenCalled();
  });

  it('resolveAppointmentTiming prefers per-appointment override', () => {
    const settings = {
      appointmentReminderTiming: 'MID_DAY_BEFORE' as const,
      birthdaySmsEnabled: true,
      birthdaySendHourUtc: 12,
      midDayReminderHourUtc: 12,
    };
    expect(
      SmsAutomationService.resolveAppointmentTiming('TWENTY_FOUR_HOURS_BEFORE', settings)
    ).toBe('TWENTY_FOUR_HOURS_BEFORE');
    expect(SmsAutomationService.resolveAppointmentTiming(undefined, settings)).toBe('MID_DAY_BEFORE');
  });
});

describe('parseAppointmentReminderTiming', () => {
  it('normalizes supported values', () => {
    expect(parseAppointmentReminderTiming('TWENTY_FOUR_HOURS_BEFORE')).toBe('TWENTY_FOUR_HOURS_BEFORE');
    expect(parseAppointmentReminderTiming('unknown')).toBe('MID_DAY_BEFORE');
  });
});
