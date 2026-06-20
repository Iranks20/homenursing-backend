export type AppointmentReminderTiming = 'MID_DAY_BEFORE' | 'TWENTY_FOUR_HOURS_BEFORE';

export const APPOINTMENT_REMINDER_TIMING_VALUES: AppointmentReminderTiming[] = [
  'MID_DAY_BEFORE',
  'TWENTY_FOUR_HOURS_BEFORE',
];

export const DEFAULT_APPOINTMENT_REMINDER_TIMING: AppointmentReminderTiming = 'MID_DAY_BEFORE';
export const DEFAULT_MID_DAY_UTC_HOUR = 12;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const normalizeAppointmentDate = (input: Date): Date => {
  const normalized = new Date(input);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

export const combineAppointmentDateAndTime = (date: Date, time: string): Date => {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number.parseInt(hoursStr ?? '0', 10);
  const minutes = Number.parseInt(minutesStr ?? '0', 10);
  const result = normalizeAppointmentDate(date);
  result.setUTCHours(
    Number.isNaN(hours) ? 0 : hours,
    Number.isNaN(minutes) ? 0 : minutes,
    0,
    0
  );
  return result;
};

export const parseAppointmentReminderTiming = (
  value: unknown
): AppointmentReminderTiming => {
  if (value === 'TWENTY_FOUR_HOURS_BEFORE' || value === 'twenty_four_hours') {
    return 'TWENTY_FOUR_HOURS_BEFORE';
  }
  return DEFAULT_APPOINTMENT_REMINDER_TIMING;
};

export const computeAppointmentReminderSendAt = (
  date: Date,
  time: string,
  timing: AppointmentReminderTiming,
  options?: {
    now?: Date;
    midDayUtcHour?: number;
  }
): Date => {
  const now = options?.now ?? new Date();
  const midDayUtcHour = options?.midDayUtcHour ?? DEFAULT_MID_DAY_UTC_HOUR;
  const appointmentAt = combineAppointmentDateAndTime(date, time);

  let sendAt: Date;
  if (timing === 'TWENTY_FOUR_HOURS_BEFORE') {
    sendAt = new Date(appointmentAt.getTime() - MS_PER_DAY);
  } else {
    sendAt = new Date(appointmentAt);
    sendAt.setUTCDate(sendAt.getUTCDate() - 1);
    sendAt.setUTCHours(midDayUtcHour, 0, 0, 0);
  }

  if (sendAt.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 60_000);
  }
  return sendAt;
};

export const isSameCalendarDayUtc = (a: Date, b: Date): boolean =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();

export const matchesBirthdayUtc = (dateOfBirth: Date, onDate: Date): boolean =>
  dateOfBirth.getUTCMonth() === onDate.getUTCMonth() &&
  dateOfBirth.getUTCDate() === onDate.getUTCDate();

export const computeBirthdaySendAt = (
  onDate: Date,
  sendHourUtc: number,
  now: Date = new Date()
): Date => {
  const sendAt = new Date(onDate);
  sendAt.setUTCHours(sendHourUtc, 0, 0, 0);
  if (sendAt.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 60_000);
  }
  return sendAt;
};
