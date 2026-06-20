import Joi from 'joi';

export const createFeedbackSchema = Joi.object({
  patientId: Joi.string().required(),
  serviceId: Joi.string().required(),
  specialistId: Joi.string().optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().optional(),
  professionalism: Joi.number().integer().min(1).max(5).required(),
  punctuality: Joi.number().integer().min(1).max(5).required(),
  communication: Joi.number().integer().min(1).max(5).required(),
  careQuality: Joi.number().integer().min(1).max(5).required(),
  isPublic: Joi.boolean().optional().default(false),
});

export const updateFeedbackSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional(),
  comment: Joi.string().optional(),
  professionalism: Joi.number().integer().min(1).max(5).optional(),
  punctuality: Joi.number().integer().min(1).max(5).optional(),
  communication: Joi.number().integer().min(1).max(5).optional(),
  careQuality: Joi.number().integer().min(1).max(5).optional(),
  isPublic: Joi.boolean().optional(),
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

