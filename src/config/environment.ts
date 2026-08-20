import dotenv from 'dotenv';

dotenv.config();

const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const isPesapalLiveEnv = (value?: string): boolean => {
  const env = (value ?? process.env.PESAPAL_ENV ?? 'sandbox').toLowerCase();
  return env === 'production' || env === 'live';
};

const defaultApiPublicUrl = (): string => {
  if (process.env.API_PUBLIC_URL?.trim()) {
    return process.env.API_PUBLIC_URL.trim().replace(/\/$/, '');
  }
  const port = process.env.PORT || '3847';
  return `http://localhost:${port}`;
};

const apiPublicUrl = defaultApiPublicUrl();
const pesapalLive = isPesapalLiveEnv(process.env.PESAPAL_ENV);

const parseCorsOrigins = (value?: string): string[] => {
  if (!value) {
    return [
      'https://homenursing-frontend-production.up.railway.app',
      'https://homenursing-backend-production.up.railway.app',
      'https://teamworkphysiointernational.com',
      'https://www.teamworkphysiointernational.com',
      'http://localhost:5291',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3847',
    ];
  }

  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter((origin) => origin.length > 0);
};

export const ENV_CONFIG = {
  // Server Configuration
  PORT: parseInt(process.env.PORT || '3007', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database Configuration
  DATABASE_URL: requiredEnv('DATABASE_URL'),

  // JWT Configuration
  JWT_SECRET: requiredEnv('JWT_SECRET'),
  JWT_REFRESH_SECRET: requiredEnv('JWT_REFRESH_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS Configuration
  CORS_ORIGIN: parseCorsOrigins(process.env.CORS_ORIGIN),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  ENABLE_RATE_LIMIT: process.env.ENABLE_RATE_LIMIT === 'true',

  // Email Configuration (EmailJS) — https://dashboard.emailjs.com
  EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID || '',
  EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY || '',
  EMAILJS_PRIVATE_KEY: process.env.EMAILJS_PRIVATE_KEY || '',
  EMAILJS_TEMPLATE_NURSE_WELCOME: process.env.EMAILJS_TEMPLATE_NURSE_WELCOME || '',
  EMAILJS_TEMPLATE_EXAM_PASSED: process.env.EMAILJS_TEMPLATE_EXAM_PASSED || '',
  EMAILJS_TEMPLATE_EXAM_FAILED: process.env.EMAILJS_TEMPLATE_EXAM_FAILED || '',
  EMAILJS_TEMPLATE_INTERVIEW_BOOKED: process.env.EMAILJS_TEMPLATE_INTERVIEW_BOOKED || '',
  EMAILJS_TEMPLATE_INTERVIEW_FAILED: process.env.EMAILJS_TEMPLATE_INTERVIEW_FAILED || '',
  EMAILJS_TEMPLATE_INTERVIEW_PASSED: process.env.EMAILJS_TEMPLATE_INTERVIEW_PASSED || '',
  EMAILJS_TEMPLATE_CERTIFIED: process.env.EMAILJS_TEMPLATE_CERTIFIED || '',
  EMAILJS_TEMPLATE_RECRUITED: process.env.EMAILJS_TEMPLATE_RECRUITED || '',
  APP_URL: (process.env.APP_URL || 'http://localhost:5291').replace(/\/$/, ''),
  API_PUBLIC_URL: apiPublicUrl,

  PESAPAL_CONSUMER_KEY: process.env.PESAPAL_CONSUMER_KEY || '',
  PESAPAL_CONSUMER_SECRET: process.env.PESAPAL_CONSUMER_SECRET || '',
  PESAPAL_ENV: process.env.PESAPAL_ENV || 'sandbox',
  PESAPAL_IPN_NOTIFICATION_ID: process.env.PESAPAL_IPN_NOTIFICATION_ID || '',
  PESAPAL_COUNTRY_CODE: process.env.PESAPAL_COUNTRY_CODE || 'UG',
  PESAPAL_API_BASE_URL:
    process.env.PESAPAL_API_BASE_URL ||
    (pesapalLive ? 'https://pay.pesapal.com/v3/api' : 'https://cybqa.pesapal.com/pesapalv3/api'),
  PESAPAL_CALLBACK_URL:
    process.env.PESAPAL_CALLBACK_URL || `${apiPublicUrl}/api/v1/payments/pesapal/callback`,
  PESAPAL_IPN_URL: process.env.PESAPAL_IPN_URL || `${apiPublicUrl}/api/v1/payments/pesapal/ipn`,

  CERTIFICATE_FEE_AMOUNT: parseFloat(process.env.CERTIFICATE_FEE_AMOUNT || '150000'),
  CERTIFICATE_FEE_CURRENCY: process.env.CERTIFICATE_FEE_CURRENCY || 'UGX',
  CERTIFICATE_FEE_DESCRIPTION: process.env.CERTIFICATE_FEE_DESCRIPTION || 'Nursing qualification certificate fee',
  CERTIFICATE_SIGNATORY_NAME: process.env.CERTIFICATE_SIGNATORY_NAME || 'Training Director',
  CERTIFICATE_SIGNATORY_TITLE: process.env.CERTIFICATE_SIGNATORY_TITLE || 'Teamwork Home Nursing',

  // SMS Configuration
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',

  // EgoSMS (Pahappa) Configuration
  EGOSMS_API_URL: process.env.EGOSMS_API_URL || 'https://comms.egosms.co/api/v1/json/',
  EGOSMS_USERNAME: process.env.EGOSMS_USERNAME || '',
  EGOSMS_PASSWORD: process.env.EGOSMS_PASSWORD || '',
  EGOSMS_SENDER_ID: process.env.EGOSMS_SENDER_ID || 'Homecare',
  EGOSMS_PRIORITY: process.env.EGOSMS_PRIORITY || '0',
  EGOSMS_ENABLED: process.env.EGOSMS_ENABLED === 'true',

  // AWS S3 Configuration
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'teamwork-homecare-files',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',

  // File Upload Configuration
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf'
  ],

  // Feature Flags
  ENABLE_REAL_TIME: process.env.ENABLE_REAL_TIME === 'true',
  ENABLE_NOTIFICATIONS: process.env.ENABLE_NOTIFICATIONS === 'true',
  ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS === 'true',

  // External Services
  SMS_SERVICE_URL: process.env.SMS_SERVICE_URL || 'https://api.twilio.com',
  EMAIL_SERVICE_URL: process.env.EMAIL_SERVICE_URL || 'https://api.sendgrid.com',
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'https://api.stripe.com',

  // Debug Configuration
  DEBUG: process.env.DEBUG === 'true',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Security Configuration
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-session-secret-key',

  // Monitoring Configuration
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
  METRICS_PORT: parseInt(process.env.METRICS_PORT || '9090', 10),

  // Backup Configuration
  BACKUP_SCHEDULE: process.env.BACKUP_SCHEDULE || '0 2 * * *',
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
};
