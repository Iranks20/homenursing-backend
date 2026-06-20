/**
 * One-off test: run patient update schema validation with the exact body that was failing.
 * Run from repo root: node scripts/test-patient-update-validation.js
 */
const Joi = require('joi');

// Mirror updatePatientSchema email/condition rules
const updateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().allow(null).optional().empty('').empty(null).default(null),
  phone: Joi.string().optional(),
  dateOfBirth: Joi.date().optional(),
  address: Joi.string().optional(),
  condition: Joi.string().allow(null).optional().empty('').empty(null).default(null),
  assignedSpecialistId: Joi.string().allow('', null).optional(),
  assignedTherapistId: Joi.string().allow('', null).optional(),
  serviceIds: Joi.array().items(Joi.string()).optional().allow(null),
  status: Joi.string().optional(),
  avatar: Joi.string().allow('', null).optional(),
  emergencyContact: Joi.string().allow('', null).optional(),
  emergencyPhone: Joi.string().allow('', null).optional(),
  allergies: Joi.string().allow('', null).optional(),
  paymentType: Joi.string().valid('CASH', 'INSURANCE').optional(),
  insuranceProvider: Joi.string().allow('', null).optional(),
  insuranceNumber: Joi.string().allow('', null).optional(),
  referralSource: Joi.string().allow('', null).optional(),
  city: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  zipCode: Joi.string().allow('', null).optional(),
}).unknown(true);

const body = {
  name: "MENATULLA MOHAMED",
  email: "",
  phone: "0706963130",
  dateOfBirth: "1983-01-25T00:00:00.000Z",
  address: "KISASI, KISASI, KISASI",
  city: "KISASI",
  state: "KISASI",
  zipCode: "",
  condition: "",
  assignedSpecialistId: "",
  assignedTherapistId: "cmlxpnu0b0002g795sdc8hbj1",
  serviceIds: [],
  status: "ACTIVE",
  avatar: "",
  emergencyContact: "WALLD HAMDY",
  emergencyPhone: "0782878742",
  allergies: "",
  paymentType: "CASH",
  insuranceProvider: "",
  insuranceNumber: "",
  referralSource: ""
};

// Normalize like controller
const normalized = { ...body };
if (normalized.email === '' || normalized.email === null) normalized.email = null;
if (normalized.condition === '' || normalized.condition === null) normalized.condition = null;

const { error, value } = updateSchema.validate(normalized, { abortEarly: false });
if (error) {
  console.error('Validation FAILED:', error.details.map(d => d.message).join(', '));
  process.exit(1);
}
console.log('Validation PASSED. email:', value.email, 'condition:', value.condition);
process.exit(0);
