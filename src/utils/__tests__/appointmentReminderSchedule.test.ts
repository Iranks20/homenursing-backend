import {
  combineAppointmentDateAndTime,
  computeAppointmentReminderSendAt,
  computeBirthdaySendAt,
  matchesBirthdayUtc,
} from '../appointmentReminderSchedule';

describe('computeAppointmentReminderSendAt', () => {
  const appointmentDate = new Date('2026-06-15T00:00:00.000Z');
  const appointmentTime = '14:30';

  it('schedules midday on the calendar day before the appointment', () => {
    const now = new Date('2026-06-10T08:00:00.000Z');
    const sendAt = computeAppointmentReminderSendAt(
      appointmentDate,
      appointmentTime,
      'MID_DAY_BEFORE',
      { now, midDayUtcHour: 12 }
    );

    expect(sendAt.toISOString()).toBe('2026-06-14T12:00:00.000Z');
  });

  it('schedules exactly twenty-four hours before the appointment time', () => {
    const now = new Date('2026-06-10T08:00:00.000Z');
    const sendAt = computeAppointmentReminderSendAt(
      appointmentDate,
      appointmentTime,
      'TWENTY_FOUR_HOURS_BEFORE',
      { now }
    );

    expect(sendAt.toISOString()).toBe('2026-06-14T14:30:00.000Z');
  });

  it('defers to one minute from now when the computed time is in the past', () => {
    const now = new Date('2026-06-14T13:00:00.000Z');
    const sendAt = computeAppointmentReminderSendAt(
      appointmentDate,
      appointmentTime,
      'MID_DAY_BEFORE',
      { now, midDayUtcHour: 12 }
    );

    expect(sendAt.getTime()).toBe(now.getTime() + 60_000);
  });
});

describe('combineAppointmentDateAndTime', () => {
  it('combines normalized date with HH:mm time in UTC', () => {
    const at = combineAppointmentDateAndTime(new Date('2026-03-01T15:45:00.000Z'), '09:15');
    expect(at.toISOString()).toBe('2026-03-01T09:15:00.000Z');
  });
});

describe('birthday helpers', () => {
  it('matches month and day in UTC regardless of year', () => {
    const dob = new Date('1990-07-04T00:00:00.000Z');
    const today = new Date('2026-07-04T18:00:00.000Z');
    expect(matchesBirthdayUtc(dob, today)).toBe(true);
    expect(matchesBirthdayUtc(dob, new Date('2026-07-05T00:00:00.000Z'))).toBe(false);
  });

  it('schedules birthday SMS at configured UTC hour on the birthday', () => {
    const today = new Date('2026-05-30T01:00:00.000Z');
    const now = new Date('2026-05-30T01:00:00.000Z');
    const sendAt = computeBirthdaySendAt(today, 12, now);
    expect(sendAt.toISOString()).toBe('2026-05-30T12:00:00.000Z');
  });
});
