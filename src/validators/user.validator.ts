import Joi from 'joi';
import { CustomError } from '../middleware/error.middleware';

const usernameSchema = Joi.string()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-Z0-9_.-]+$/)
  .trim()
  .required()
  .messages({
    'string.pattern.base': 'Username can only contain letters, numbers, dots, hyphens, and underscores',
  });

export const createUserSchema = Joi.object({
  username: usernameSchema,
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().allow('', null).optional().custom((value) => (value === '' ? null : value)),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('ADMIN', 'APPLICANT', 'NURSE', 'TRAINER', 'SUPERVISOR', 'RECEPTIONIST', 'SPECIALIST', 'THERAPIST', 'BILLER').required(),
  specialistSpecialization: Joi.string().valid('NEUROLOGIST', 'ORTHOPEDIST', 'PHYSIOTHERAPIST').optional(),
  specialistType: Joi.string().valid('SPEECH_THERAPIST', 'GERIATRICIAN', 'OCCUPATIONAL_THERAPIST').optional(),
  therapistSpecialization: Joi.string().valid('PHYSIOTHERAPY', 'OCCUPATIONAL_THERAPY', 'SPEECH_THERAPY', 'SPORTS_THERAPY', 'PEDIATRIC_THERAPY', 'GERIATRIC_THERAPY').optional(),
  employeeId: Joi.string().optional(),
  licenseNumber: Joi.string().optional(),
  phone: Joi.string().optional(),
  dateOfBirth: Joi.date().optional().allow(null),
  department: Joi.string().optional(),
  payFrequency: Joi.string().valid('WEEKLY', 'MONTHLY').optional().allow(null),
  workStartDate: Joi.date().iso().optional().allow(null),
  avatar: Joi.string().allow('', null).optional().custom((value, helpers) => {
    if (value === '' || !value) return undefined;
    const uriRegex = /^https?:\/\/.+/;
    const pathRegex = /^\/uploads\/.+/;
    if (uriRegex.test(value) || pathRegex.test(value)) {
      return value;
    }
    if (value.startsWith('uploads/')) {
      return '/' + value;
    }
    return value;
  }),
  isActive: Joi.boolean().optional(),
});

export const updateUserSchema = Joi.object({
  username: Joi.string().min(2).max(50).pattern(/^[a-zA-Z0-9_.-]+$/).trim().optional(),
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  role: Joi.string().valid('ADMIN', 'APPLICANT', 'NURSE', 'TRAINER', 'SUPERVISOR', 'RECEPTIONIST', 'SPECIALIST', 'THERAPIST', 'BILLER', 'LAB_ATTENDANT').uppercase().optional(),
  phone: Joi.string().optional(),
  dateOfBirth: Joi.date().optional().allow(null),
  department: Joi.string().optional(),
  avatar: Joi.string().allow('', null).optional().custom((value, helpers) => {
    if (value === '' || !value) return undefined;
    const uriRegex = /^https?:\/\/.+/;
    const pathRegex = /^\/uploads\/.+/;
    if (uriRegex.test(value) || pathRegex.test(value)) {
      return value;
    }
    if (value.startsWith('uploads/')) {
      return '/' + value;
    }
    return value;
  }),
  password: Joi.string().min(8).optional(),
  specialistSpecialization: Joi.string().valid('NEUROLOGIST', 'ORTHOPEDIST', 'PHYSIOTHERAPIST').optional(),
  specialistType: Joi.string().valid('SPEECH_THERAPIST', 'GERIATRICIAN', 'OCCUPATIONAL_THERAPIST').optional(),
  therapistSpecialization: Joi.string().valid('PHYSIOTHERAPY', 'OCCUPATIONAL_THERAPY', 'SPEECH_THERAPY', 'SPORTS_THERAPY', 'PEDIATRIC_THERAPY', 'GERIATRIC_THERAPY').optional(),
  employeeId: Joi.string().optional(),
  licenseNumber: Joi.string().optional(),
  consultationFee: Joi.number().integer().min(0).allow(null).optional(),
  payFrequency: Joi.string().valid('WEEKLY', 'MONTHLY').optional().allow(null),
  workStartDate: Joi.date().iso().optional().allow(null),
  isActive: Joi.boolean().optional(),
}).unknown(false);

export const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

export const searchUsersSchema = Joi.object({
  query: Joi.string().optional(),
  role: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(500).default(10),
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().optional(),
  department: Joi.string().optional(),
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

