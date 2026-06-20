import Joi from 'joi';
import { CustomError } from '../middleware/error.middleware';

export const createPatientSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().allow('', null).optional().custom((value) => (value === '' ? null : value)),
  phone: Joi.string().required(),
  dateOfBirth: Joi.date().required(),
  address: Joi.string().required(),
  location: Joi.string().max(500).allow('', null).optional(),
  condition: Joi.string().allow('', null).optional(),
  assignedNurseId: Joi.string().allow('', null).optional().custom((value) => {
    return value === '' ? null : value;
  }),
  assignedSpecialistId: Joi.string().allow('', null).optional().custom((value) => {
    return value === '' ? null : value;
  }),
  assignedTherapistId: Joi.string().allow('', null).optional().custom((value) => {
    return value === '' ? null : value;
  }),
  avatar: Joi.string().allow('').optional().custom((value, helpers) => {
    if (value === '' || !value) return undefined;
    // Allow both URIs (http://, https://) and file paths (/uploads/...)
    const uriRegex = /^https?:\/\/.+/;
    const pathRegex = /^\/uploads\/.+/;
    if (uriRegex.test(value) || pathRegex.test(value)) {
      return value;
    }
    // If it's a relative path starting with uploads, make it absolute
    if (value.startsWith('uploads/')) {
      return '/' + value;
    }
    return value;
  }),
  status: Joi.string().optional().custom((value, helpers) => {
    if (!value) return undefined;
    const upperValue = value.toUpperCase();
    if (['ACTIVE', 'DISCHARGED', 'PENDING'].includes(upperValue)) {
      return upperValue;
    }
    return helpers.error('any.only', { values: 'ACTIVE, DISCHARGED, PENDING' });
  }),
  // Allow additional optional fields that may be sent from frontend but not stored (allow empty strings)
  city: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  zipCode: Joi.string().allow('', null).optional(),
  emergencyContact: Joi.string().allow('', null).optional(),
  emergencyPhone: Joi.string().allow('', null).optional(),
  medicalHistory: Joi.string().allow('', null).optional().custom((value) => {
    // Convert empty string to null for database
    return value === '' ? null : value;
  }),
  medicalHistoryNotes: Joi.string().allow('', null).optional().custom((value) => {
    // Convert empty string to null for database
    return value === '' ? null : value;
  }),
  currentMedications: Joi.string().allow('', null).optional(),
  allergies: Joi.string().allow('', null).optional(),
  paymentType: Joi.string().valid('CASH', 'INSURANCE').optional().default('CASH'),
  insuranceProvider: Joi.string().allow('', null).optional(),
  insuranceNumber: Joi.string().allow('', null).optional(),
  referralSource: Joi.string().allow('', null).optional(),
  serviceIds: Joi.array().items(Joi.string()).optional().allow(null),
  metadata: Joi.object().optional(),
}).unknown(false);

export const updatePatientSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().allow(null).optional().empty('').empty(null).default(null),
  phone: Joi.string().optional(),
  dateOfBirth: Joi.date().optional(),
  address: Joi.string().optional(),
  location: Joi.string().max(500).allow('', null).optional(),
  condition: Joi.string().allow(null).optional().empty('').empty(null).default(null),
  assignedNurseId: Joi.string().allow('', null).optional().custom((value) => {
    return value === '' ? null : value;
  }),
  assignedSpecialistId: Joi.string().allow('', null).optional().custom((value) => {
    return value === '' ? null : value;
  }),
  assignedTherapistId: Joi.string().allow('', null).optional().custom((value) => {
    return value === '' ? null : value;
  }),
  avatar: Joi.string().allow('', null).optional().custom((value, helpers) => {
    if (value === '' || !value) return undefined;
    // Allow both URIs (http://, https://) and file paths (/uploads/...)
    const uriRegex = /^https?:\/\/.+/;
    const pathRegex = /^\/uploads\/.+/;
    if (uriRegex.test(value) || pathRegex.test(value)) {
      return value;
    }
    // If it's a relative path starting with uploads, make it absolute
    if (value.startsWith('uploads/')) {
      return '/' + value;
    }
    return value;
  }),
  status: Joi.string().optional().custom((value, helpers) => {
    if (!value) return value;
    const upperValue = value.toUpperCase();
    if (['ACTIVE', 'DISCHARGED', 'PENDING'].includes(upperValue)) {
      return upperValue;
    }
    return helpers.error('any.only', { values: 'ACTIVE, DISCHARGED, PENDING' });
  }),
  // Allow additional optional fields (allow empty strings)
  city: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  zipCode: Joi.string().allow('', null).optional(),
  emergencyContact: Joi.string().allow('', null).optional(),
  emergencyPhone: Joi.string().allow('', null).optional(),
  medicalHistory: Joi.string().allow('', null).optional().custom((value) => {
    // Convert empty string to null for database
    return value === '' ? null : value;
  }),
  medicalHistoryNotes: Joi.string().allow('', null).optional().custom((value) => {
    // Convert empty string to null for database
    return value === '' ? null : value;
  }),
  currentMedications: Joi.string().allow('', null).optional(),
  allergies: Joi.string().allow('', null).optional(),
  paymentType: Joi.string().valid('CASH', 'INSURANCE').optional().default('CASH'),
  insuranceProvider: Joi.string().allow('', null).optional(),
  insuranceNumber: Joi.string().allow('', null).optional(),
  referralSource: Joi.string().allow('', null).optional(),
  serviceIds: Joi.array().items(Joi.string()).optional().allow(null),
  metadata: Joi.object().optional(),
}).unknown(false);

export const updatePatientStatusSchema = Joi.object({
  status: Joi.string().required().custom((value, helpers) => {
    // Convert to uppercase for case-insensitive matching
    const upperValue = value.toUpperCase();
    if (['ACTIVE', 'DISCHARGED', 'PENDING'].includes(upperValue)) {
      return upperValue;
    }
    return helpers.error('any.only', { values: 'ACTIVE, DISCHARGED, PENDING' });
  }),
});

export const searchPatientsSchema = Joi.object({
  query: Joi.string().optional(),
  status: Joi.string().optional().custom((value, helpers) => {
    if (!value) return value;
    // Convert to uppercase for case-insensitive matching
    const upperValue = value.toUpperCase();
    if (['ACTIVE', 'DISCHARGED', 'PENDING'].includes(upperValue)) {
      return upperValue;
    }
    return helpers.error('any.only', { values: 'ACTIVE, DISCHARGED, PENDING' });
  }),
  assignedNurseId: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(10),
});

export const createMedicalRecordSchema = Joi.object({
  date: Joi.date().required(),
  diagnosis: Joi.string().required(),
  treatment: Joi.string().required(),
  notes: Joi.string().required(),
  doctor: Joi.string().required(),
});

export const updateMedicalRecordSchema = Joi.object({
  date: Joi.date().optional(),
  diagnosis: Joi.string().optional(),
  treatment: Joi.string().optional(),
  notes: Joi.string().optional(),
  doctor: Joi.string().optional(),
});

export const createProgressRecordSchema = Joi.object({
  date: Joi.date().required(),
  metric: Joi.string().required(),
  value: Joi.number().required(),
  unit: Joi.string().required(),
  notes: Joi.string().optional(),
});

export const updateProgressRecordSchema = Joi.object({
  date: Joi.date().optional(),
  metric: Joi.string().optional(),
  value: Joi.number().optional(),
  unit: Joi.string().optional(),
  notes: Joi.string().optional(),
});

export const createPatientCaseSchema = Joi.object({
  type: Joi.string().valid('NEW', 'FOLLOW_UP').required(),
  diagnosis: Joi.string().optional(),
  attending: Joi.string().optional(),
  notes: Joi.string().optional(),
});

export const logCaseVisitSchema = Joi.object({
  details: Joi.string().allow('', null).optional(),
});

export function validateBody<T>(schema: Joi.Schema, data: unknown): T {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new CustomError(error.details.map((d) => d.message).join(', '), 400);
  }
  return value as T;
}

export function validateQuery<T>(schema: Joi.Schema, data: unknown): T {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new CustomError(error.details.map((d) => d.message).join(', '), 400);
  }
  return value as T;
}

