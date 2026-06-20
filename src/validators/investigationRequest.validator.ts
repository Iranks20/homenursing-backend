import Joi from 'joi';

export function validateBody<T>(schema: Joi.Schema, data: unknown): T {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) throw new Error(error.details.map((d) => d.message).join(', '));
  return value as T;
}

export function validateQuery<T>(schema: Joi.Schema, data: unknown): T {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) throw new Error(error.details.map((d) => d.message).join(', '));
  return value as T;
}

export const createInvestigationRequestSchema = Joi.object({
  patientId: Joi.string().required(),
  investigationName: Joi.string().min(1).max(200).required(),
  priority: Joi.string().valid('ROUTINE', 'URGENT', 'STAT').default('ROUTINE'),
  notes: Joi.string().allow('', null).max(1000),
});

export const updateInvestigationRequestSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
  labSampleId: Joi.string().allow(null),
  completedById: Joi.string().allow(null),
  completedByName: Joi.string().allow(null),
  notes: Joi.string().allow('', null).max(1000),
});

export const listInvestigationRequestsQuerySchema = Joi.object({
  patientId: Joi.string(),
  status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
  requestedById: Joi.string(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
