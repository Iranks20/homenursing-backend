import Joi from 'joi';

export const assignNurseSchema = Joi.object({
  patientId: Joi.string().required(),
  nurseId: Joi.string().required(),
  location: Joi.string().max(500).optional().allow('', null),
  notes: Joi.string().max(2000).optional().allow('', null),
  assignedAt: Joi.date().iso().optional(),
});

export const createReportSchema = Joi.object({
  nurseId: Joi.string().required(),
  patientId: Joi.string().optional().allow('', null),
  title: Joi.string().min(2).max(200).required(),
  content: Joi.string().min(2).max(10000).required(),
  visitDate: Joi.date().iso().optional().allow(null),
});

export const listAssignmentsSchema = Joi.object({
  nurseId: Joi.string().optional(),
  patientId: Joi.string().optional(),
  status: Joi.string().valid('ACTIVE', 'ENDED').optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
});

export const listReportsSchema = Joi.object({
  nurseId: Joi.string().optional(),
  patientId: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
});
