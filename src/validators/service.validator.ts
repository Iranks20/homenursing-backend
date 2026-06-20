import Joi from 'joi';

export const createServiceSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  category: Joi.string().trim().min(1).max(255).required(),
  price: Joi.number().positive().required(),
  duration: Joi.number().integer().min(15).required(),
  features: Joi.array().items(Joi.string()).optional(),
  image: Joi.string().uri().allow('').optional(),
});

export const updateServiceSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  category: Joi.string().trim().min(1).max(255).optional(),
  price: Joi.number().positive().optional(),
  duration: Joi.number().integer().min(15).optional(),
  features: Joi.array().items(Joi.string()).optional(),
  image: Joi.string().uri().allow('').optional(),
  isActive: Joi.boolean().optional(),
});

export const searchServicesSchema = Joi.object({
  query: Joi.string().optional(),
  category: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
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

