import Joi from 'joi';
import { CustomError } from '../middleware/error.middleware';

// Common validation patterns
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .max(255)
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
    'string.max': 'Email must not exceed 255 characters',
    'any.required': 'Email is required'
  });

const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must not exceed 128 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'string.empty': 'Password is required',
    'any.required': 'Password is required'
  });

const nameSchema = Joi.string()
  .min(2)
  .max(100)
  .trim()
  .pattern(/^[a-zA-Z\s\-'\.]+$/)
  .required()
  .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name must not exceed 100 characters',
    'string.pattern.base': 'Name can only contain letters, spaces, hyphens, apostrophes, and periods',
    'string.empty': 'Name is required',
    'any.required': 'Name is required'
  });

const phoneSchema = Joi.string()
  .pattern(/^\+?[\d\s\-\(\)]+$/)
  .min(10)
  .max(20)
  .optional()
  .messages({
    'string.pattern.base': 'Please provide a valid phone number',
    'string.min': 'Phone number must be at least 10 characters long',
    'string.max': 'Phone number must not exceed 20 characters'
  });

const roleSchema = Joi.string()
  .valid(
    'ADMIN',
    'RECEPTIONIST',
    'SPECIALIST',
    'THERAPIST',
    'NURSE'
  )
  .required()
  .messages({
    'any.only': 'Invalid user role',
    'any.required': 'User role is required'
  });

// Username validation (for login and user creation)
const usernameSchema = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-Z0-9_.-]+$/)
  .required()
  .messages({
    'string.min': 'Username must be at least 2 characters',
    'string.max': 'Username must not exceed 50 characters',
    'string.pattern.base': 'Username can only contain letters, numbers, dots, hyphens, and underscores',
    'string.empty': 'Username is required',
    'any.required': 'Username is required'
  });

// Login validation schema (username + password)
export const loginSchema = Joi.object({
  username: usernameSchema,
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required'
  }),
  rememberMe: Joi.boolean().optional().default(false)
}).options({ abortEarly: false });

// Registration validation schema
export const registerSchema = Joi.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match password',
      'any.required': 'Password confirmation is required'
    }),
  role: roleSchema,
  phone: phoneSchema,
  department: Joi.string()
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.max': 'Department must not exceed 100 characters'
    }),
  acceptTerms: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'You must accept the terms and conditions',
      'any.required': 'Terms and conditions acceptance is required'
    })
}).options({ abortEarly: false });

// Password reset request schema
export const forgotPasswordSchema = Joi.object({
  email: emailSchema
}).options({ abortEarly: false });

// Password reset confirmation schema
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Reset token is required',
    'any.required': 'Reset token is required'
  }),
  password: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match password',
      'any.required': 'Password confirmation is required'
    })
}).options({ abortEarly: false });

// Change password schema (for authenticated users)
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required',
    'any.required': 'Current password is required'
  }),
  newPassword: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match new password',
      'any.required': 'Password confirmation is required'
    })
}).options({ abortEarly: false });

// Email verification schema
export const verifyEmailSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Verification token is required',
    'any.required': 'Verification token is required'
  })
}).options({ abortEarly: false });

// Resend verification email schema
export const resendVerificationSchema = Joi.object({
  email: emailSchema
}).options({ abortEarly: false });

// Refresh token schema
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required',
    'any.required': 'Refresh token is required'
  })
}).options({ abortEarly: false });

// Two-factor authentication schemas
export const enableTwoFactorSchema = Joi.object({
  password: Joi.string().required().messages({
    'string.empty': 'Password is required for 2FA setup',
    'any.required': 'Password is required for 2FA setup'
  })
}).options({ abortEarly: false });

export const verifyTwoFactorSchema = Joi.object({
  token: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.length': '2FA token must be exactly 6 digits',
      'string.pattern.base': '2FA token must contain only numbers',
      'string.empty': '2FA token is required',
      'any.required': '2FA token is required'
    }),
  backupCode: Joi.string()
    .length(8)
    .pattern(/^[A-Z0-9]+$/)
    .optional()
    .messages({
      'string.length': 'Backup code must be exactly 8 characters',
      'string.pattern.base': 'Backup code must contain only uppercase letters and numbers'
    })
}).options({ abortEarly: false });

export const disableTwoFactorSchema = Joi.object({
  password: Joi.string().required().messages({
    'string.empty': 'Password is required to disable 2FA',
    'any.required': 'Password is required to disable 2FA'
  }),
  token: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.length': '2FA token must be exactly 6 digits',
      'string.pattern.base': '2FA token must contain only numbers',
      'string.empty': '2FA token is required',
      'any.required': '2FA token is required'
    })
}).options({ abortEarly: false });

// Session management schemas
export const revokeSessionSchema = Joi.object({
  sessionId: Joi.string().required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required'
  })
}).options({ abortEarly: false });

export const revokeAllSessionsSchema = Joi.object({
  password: Joi.string().required().messages({
    'string.empty': 'Password is required to revoke all sessions',
    'any.required': 'Password is required to revoke all sessions'
  })
}).options({ abortEarly: false });

// Update profile schema
export const updateProfileSchema = Joi.object({
  name: nameSchema.optional(),
  phone: phoneSchema,
  department: Joi.string()
    .max(100)
    .trim()
    .optional()
    .allow(null)
    .messages({
      'string.max': 'Department must not exceed 100 characters'
    }),
  avatar: Joi.string()
    .allow('', null)
    .optional()
    .custom((value, helpers) => {
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
    })
    .messages({
      'string.uri': 'Avatar must be a valid URL or file path'
    })
}).options({ abortEarly: false });

export const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required().messages({
    'boolean.base': 'isActive must be a boolean',
    'any.required': 'isActive is required',
  }),
}).options({ abortEarly: false });

// Query parameter schemas
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1'
  }),
  limit: Joi.number().integer().min(1).max(100).optional().default(10).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit must not exceed 100'
  }),
  sort: Joi.string().valid('createdAt', 'updatedAt', 'name', 'email').optional().default('createdAt').messages({
    'any.only': 'Invalid sort field'
  }),
  order: Joi.string().valid('asc', 'desc').optional().default('desc').messages({
    'any.only': 'Sort order must be either asc or desc'
  })
}).options({ abortEarly: false });

// Search schema
export const searchSchema = Joi.object({
  q: Joi.string().min(2).max(100).trim().optional().messages({
    'string.min': 'Search query must be at least 2 characters long',
    'string.max': 'Search query must not exceed 100 characters'
  }),
  role: roleSchema.optional(),
  isActive: Joi.boolean().optional(),
  isVerified: Joi.boolean().optional(),
  dateFrom: Joi.date().iso().optional().messages({
    'date.format': 'Date from must be in ISO format'
  }),
  dateTo: Joi.date().iso().optional().messages({
    'date.format': 'Date to must be in ISO format'
  })
}).options({ abortEarly: false });

// Validation helper functions
export const validateRequest = (schema: Joi.ObjectSchema, data: any) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));

    // Create a user-friendly error message
    const errorMessages = errorDetails.map(detail => detail.message).join('; ');
    
    // Throw a proper CustomError with 400 status code for validation errors
    const validationError = new CustomError(
      `Validation failed: ${errorMessages}`,
      400,
      true
    );
    
    // Attach details for debugging
    (validationError as any).details = errorDetails;
    (validationError as any).isValidationError = true;
    
    throw validationError;
  }

  return value;
};

export const validateQuery = (schema: Joi.ObjectSchema, query: any) => {
  return validateRequest(schema, query);
};

export const validateBody = (schema: Joi.ObjectSchema, body: any) => {
  return validateRequest(schema, body);
};

export const validateParams = (schema: Joi.ObjectSchema, params: any) => {
  return validateRequest(schema, params);
};
