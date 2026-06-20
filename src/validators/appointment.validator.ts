import Joi from 'joi';

export const createAppointmentSchema = Joi.object({
  patientId: Joi.string().required(),
  nurseId: Joi.string().optional(),
  specialistId: Joi.string().optional(),
  therapistId: Joi.string().optional(),
  serviceId: Joi.string().required(),
  date: Joi.date().required(),
  time: Joi.string().required(),
  duration: Joi.number().integer().min(15).default(30),
  notes: Joi.string().optional(),
  patientPhone: Joi.string().allow('', null).optional(),
  notifyPatient: Joi.boolean().optional(),
  reminderTiming: Joi.string().valid('MID_DAY_BEFORE', 'TWENTY_FOUR_HOURS_BEFORE').optional(),
});

const APPOINTMENT_STATUS_VALUES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'RESCHEDULED',
  'NO_SHOW',
] as const;

export const updateAppointmentSchema = Joi.object({
  patientId: Joi.string().optional(),
  nurseId: Joi.string().optional(),
  specialistId: Joi.string().optional(),
  therapistId: Joi.string().optional().allow(null),
  serviceId: Joi.string().optional(),
  date: Joi.date().optional(),
  time: Joi.string().optional(),
  duration: Joi.number().integer().min(15).optional(),
  notes: Joi.string().optional(),
  status: Joi.string().valid(...APPOINTMENT_STATUS_VALUES).optional(),
  patientPhone: Joi.string().allow('', null).optional(),
  notifyPatient: Joi.boolean().optional(),
  reminderTiming: Joi.string().valid('MID_DAY_BEFORE', 'TWENTY_FOUR_HOURS_BEFORE').optional(),
});

export const searchAppointmentsSchema = Joi.object({
  patientId: Joi.string().optional(),
  nurseId: Joi.string().optional(),
  specialistId: Joi.string().optional(),
  therapistId: Joi.string().optional(),
  status: Joi.string().valid(...APPOINTMENT_STATUS_VALUES).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export const rescheduleAppointmentSchema = Joi.object({
  date: Joi.date().required(),
  time: Joi.string().required(),
  reason: Joi.string().optional(),
});

export const cancelAppointmentSchema = Joi.object({
  reason: Joi.string().optional(),
});

export function validateBody<T>(schema: Joi.Schema, data: unknown): T {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw new Error(error.details.map(d => d.message).join(', '));
  }
  return value as T;
}

export function validateQuery<T>(schema: Joi.Schema, data: unknown): T {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw new Error(error.details.map(d => d.message).join(', '));
  }
  return value as T;
}

