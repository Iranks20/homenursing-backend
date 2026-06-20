import Joi from 'joi';

export const collectLabSampleSchema = Joi.object({
  patientId: Joi.string().required(),
  sampleType: Joi.string().valid('BLOOD', 'URINE', 'STOOL', 'SPUTUM', 'TISSUE', 'SWAB', 'OTHER').required(),
  testName: Joi.string().required(),
  testCode: Joi.string().required(),
  collectionDate: Joi.date().required(),
  collectionTime: Joi.string().required(),
  collectedBy: Joi.string().required(),
  collectionLocation: Joi.string().required(),
  priority: Joi.string().valid('ROUTINE', 'URGENT', 'STAT').default('ROUTINE'),
  instructions: Joi.string().required(),
  fastingRequired: Joi.boolean().default(false),
  fastingHours: Joi.number().integer().optional(),
  specialInstructions: Joi.string().optional(),
  labId: Joi.string().optional(),
  labName: Joi.string().optional(),
  notes: Joi.string().optional(),
});

export const updateLabSampleSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'COLLECTED', 'IN_TRANSIT', 'RECEIVED', 'PROCESSING', 'COMPLETED', 'CANCELLED').optional(),
  trackingNumber: Joi.string().optional(),
  labId: Joi.string().optional(),
  labName: Joi.string().optional(),
  notes: Joi.string().optional(),
});

export const addLabResultSchema = Joi.object({
  sampleId: Joi.string().required(),
  testName: Joi.string().required(),
  testCode: Joi.string().required(),
  result: Joi.string().required(),
  value: Joi.number().required(),
  unit: Joi.string().optional(),
  referenceRange: Joi.string().required(),
  status: Joi.string().valid('NORMAL', 'ABNORMAL', 'CRITICAL', 'PENDING').default('NORMAL'),
  flagged: Joi.boolean().default(false),
  comments: Joi.string().optional(),
  reportedBy: Joi.string().required(),
  verifiedBy: Joi.string().optional(),
});

export const sendReferralSchema = Joi.object({
  patientId: Joi.string().required(),
  referredBy: Joi.string().required(),
  referredByName: Joi.string().required(),
  referredByRole: Joi.string().valid('SPECIALIST', 'THERAPIST', 'NURSE').required(),
  referredTo: Joi.string().required(),
  referredToName: Joi.string().required(),
  referredToRole: Joi.string().valid('SPECIALIST', 'LAB', 'IMAGING', 'THERAPY', 'OTHER').required(),
  referralType: Joi.string().valid('CONSULTATION', 'LAB_WORK', 'IMAGING', 'THERAPY', 'SURGERY', 'FOLLOW_UP').required(),
  specialty: Joi.string().optional(),
  reason: Joi.string().required(),
  urgency: Joi.string().valid('ROUTINE', 'URGENT', 'EMERGENCY').default('ROUTINE'),
  appointmentDate: Joi.date().optional(),
  appointmentTime: Joi.string().optional(),
  location: Joi.string().optional(),
  contactInfo: Joi.string().optional(),
  notes: Joi.string().optional(),
  attachments: Joi.array().items(Joi.string()).optional(),
  followUpRequired: Joi.boolean().default(false),
  followUpDate: Joi.date().optional(),
  insuranceProvider: Joi.string().optional(),
  policyNumber: Joi.string().optional(),
  authorizationRequired: Joi.boolean().default(false),
  authorizationNumber: Joi.string().optional(),
  status: Joi.string().valid('PENDING', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED').optional(),
});

export function validateBody<T>(schema: Joi.Schema, data: unknown): T {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw new Error(error.details.map(d => d.message).join(', '));
  }
  return value as T;
}

