import { PayFrequency } from '@prisma/client';

export interface PaymentScheduleEntry {
  date: string;
  label: string;
  isPast: boolean;
  isNext: boolean;
}

export function buildStaffPaymentSchedule(
  workStartDate: Date,
  frequency: PayFrequency,
  options?: { pastCount?: number; futureCount?: number; referenceDate?: Date }
): PaymentScheduleEntry[] {
  const pastCount = options?.pastCount ?? 6;
  const futureCount = options?.futureCount ?? 6;
  const today = startOfDay(options?.referenceDate ?? new Date());
  const start = startOfDay(workStartDate);

  const allDates: Date[] = [];
  let cursor = new Date(start);

  while (cursor.getTime() <= today.getTime()) {
    allDates.push(new Date(cursor));
    cursor = advancePaymentDate(cursor, frequency);
  }

  const upcoming: Date[] = [];
  let nextCursor = allDates.length > 0 ? advancePaymentDate(allDates[allDates.length - 1]!, frequency) : new Date(start);
  if (allDates.length === 0 && start.getTime() > today.getTime()) {
    nextCursor = new Date(start);
  } else if (allDates.length === 0) {
    nextCursor = new Date(start);
  }

  for (let i = 0; i < futureCount; i += 1) {
    if (nextCursor.getTime() >= start.getTime()) {
      upcoming.push(new Date(nextCursor));
    }
    nextCursor = advancePaymentDate(nextCursor, frequency);
  }

  const pastSlice = allDates.slice(-pastCount);
  const combined = [...pastSlice, ...upcoming];
  const uniqueByTime = new Map<number, Date>();
  combined.forEach((date) => uniqueByTime.set(date.getTime(), date));
  const sorted = Array.from(uniqueByTime.values()).sort((a, b) => a.getTime() - b.getTime());

  const nextPaymentTime =
    sorted.find((date) => date.getTime() >= today.getTime())?.getTime() ??
    upcoming[0]?.getTime();

  return sorted.map((date) => ({
    date: date.toISOString(),
    label: formatPaymentLabel(date, frequency),
    isPast: date.getTime() < today.getTime(),
    isNext: date.getTime() === nextPaymentTime,
  }));
}

export function getNextPaymentDate(
  workStartDate: Date,
  frequency: PayFrequency,
  referenceDate: Date = new Date()
): Date | null {
  const schedule = buildStaffPaymentSchedule(workStartDate, frequency, {
    pastCount: 24,
    futureCount: 1,
    referenceDate,
  });
  const next = schedule.find((entry) => entry.isNext);
  return next ? new Date(next.date) : null;
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function advancePaymentDate(date: Date, frequency: PayFrequency): Date {
  const next = new Date(date);
  if (frequency === 'WEEKLY') {
    next.setDate(next.getDate() + 7);
    return next;
  }
  next.setMonth(next.getMonth() + 1);
  return next;
}

function formatPaymentLabel(date: Date, frequency: PayFrequency): string {
  const formatted = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return frequency === 'WEEKLY' ? `Week ending ${formatted}` : formatted;
}
