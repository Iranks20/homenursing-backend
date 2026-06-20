import dotenv from 'dotenv';

dotenv.config();

const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const parseCorsOrigins = (value?: string): string[] => {
  if (!value) {
    return [
      'http://44.192.24.24',
      'https://teamworkphysiointernational.com',
      'https://www.teamworkphysiointernational.com',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://51.20.55.20:3007',
      'http://51.20.98.153',
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

  // Email Configuration (Brevo)
  BREVO_API_KEY: process.env.BREVO_API_KEY || '',
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || '',
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || 'Teamwork Home Nursing',
  APP_URL: (process.env.APP_URL || 'http://localhost:5291').replace(/\/$/, ''),

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
