import Joi from 'joi';

export const createHealthRecordSchema = Joi.object({
  patientId: Joi.string().required(),
  recordType: Joi.string().valid('VITAL', 'MEDICATION', 'SYMPTOM', 'NOTE', 'ASSESSMENT', 'TREATMENT').required(),
  data: Joi.object().required(),
  location: Joi.string().optional(),
  notes: Joi.string().optional(),
});

export const updateHealthRecordSchema = Joi.object({
  recordType: Joi.string().optional().custom((value, helpers) => {
    if (!value) return value;
    // Convert to uppercase for case-insensitive matching
    const upperValue = value.toUpperCase();
    if (['VITAL', 'MEDICATION', 'SYMPTOM', 'NOTE', 'ASSESSMENT', 'TREATMENT'].includes(upperValue)) {
      return upperValue;
    }
    return helpers.error('any.only', { values: 'VITAL, MEDICATION, SYMPTOM, NOTE, ASSESSMENT, TREATMENT' });
  }),
  data: Joi.object().optional(),
  location: Joi.string().optional(),
  notes: Joi.string().optional(),
  verified: Joi.boolean().optional(),
});

export const searchHealthRecordsSchema = Joi.object({
  patientId: Joi.string().optional(),
  recordType: Joi.string().optional(),
  verified: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
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

