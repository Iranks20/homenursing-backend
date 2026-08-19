import request from 'supertest';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

jest.mock('../../middleware/clinicalAccess.middleware', () => ({
  requireClinicalAccess: (_req: any, _res: any, next: any) => next(),
  hasClinicalAccess: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../services/lab.service', () => ({
  LabService: {
    getLabSamples: jest.fn().mockResolvedValue({ samples: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    getLabResults: jest.fn().mockResolvedValue({ results: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
  },
  ReferralService: {
    getReferrals: jest.fn().mockResolvedValue({ referrals: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
  },
}));

jest.mock('../../services/patient.service', () => ({
  PatientService: {
    getPatients: jest.fn().mockResolvedValue({ patients: [], pagination: { page: 1, limit: 200, total: 0, totalPages: 0 } }),
  },
}));

jest.mock('../../services/supervision.service', () => ({
  __esModule: true,
  default: {
    listAssignments: jest.fn().mockResolvedValue({ assignments: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
    listReports: jest.fn().mockResolvedValue({ reports: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
  },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'applicant-1', role: 'APPLICANT' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  requireStaff: (_req: any, _res: any, next: any) => next(),
  requireMedicalStaff: (_req: any, _res: any, next: any) => next(),
  requireSpecialistsAndTherapists: (_req: any, _res: any, next: any) => next(),
  requireReceptionistOrAdmin: (_req: any, _res: any, next: any) => next(),
  requireReceptionistAdminOrBiller: (_req: any, _res: any, next: any) => next(),
  requireAdminOrBiller: (_req: any, _res: any, next: any) => next(),
  requireOwnership: () => (_req: any, _res: any, next: any) => next(),
  requireSelfOrAdmin: () => (_req: any, _res: any, next: any) => next(),
  requireEmailVerification: (_req: any, _res: any, next: any) => next(),
  authorize: () => (_req: any, _res: any, next: any) => next(),
  logAuthEvent: () => (_req: any, _res: any, next: any) => next(),
  authRateLimit: {},
}));

jest.mock('../../services/certificatePayment.service', () => ({
  __esModule: true,
  default: {
    initiateForUser: jest.fn().mockResolvedValue({
      paymentId: 'pay-1',
      redirectUrl: 'https://pay.pesapal.com/checkout',
      amount: 150000,
      currency: 'UGX',
      merchantReference: 'CERT-app-1',
    }),
    getLatestForUser: jest.fn().mockResolvedValue(null),
    processCallback: jest.fn().mockResolvedValue({ completed: true }),
  },
}));

jest.mock('../../services/pesapal.service', () => ({
  __esModule: true,
  default: {
    getConfigurationStatus: jest.fn().mockReturnValue({
      configured: false,
      env: 'live',
      apiBaseUrl: 'https://pay.pesapal.com/v3/api',
      callbackUrl: 'http://localhost:3847/api/v1/payments/pesapal/callback',
      ipnUrl: 'http://localhost:3847/api/v1/payments/pesapal/ipn',
      issues: ['Missing PESAPAL_IPN_NOTIFICATION_ID'],
    }),
    verifyConnection: jest.fn().mockResolvedValue({ ok: true, message: 'Pesapal authentication succeeded' }),
  },
}));

jest.mock('../../config/environment', () => ({
  ENV_CONFIG: {
    APP_URL: 'http://localhost:5291',
    CORS_ORIGIN: ['http://localhost:5291'],
    CERTIFICATE_FEE_AMOUNT: 150000,
    CERTIFICATE_FEE_CURRENCY: 'UGX',
    CERTIFICATE_FEE_DESCRIPTION: 'Nursing qualification certificate fee',
    PESAPAL_CONSUMER_KEY: 'key',
    PESAPAL_CONSUMER_SECRET: 'secret',
  },
}));

import app from '../../app';
import CertificatePaymentService from '../../services/certificatePayment.service';

describe('certificate payment routes', () => {
  it('GET /api/v1/payments/pesapal/health returns config and auth status', async () => {
    const response = await request(app).get('/api/v1/payments/pesapal/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('certificate-pesapal');
    expect(response.body.data.config.callbackUrl).toContain('/pesapal/callback');
    expect(response.body.data.auth.ok).toBe(true);
  });

  it('GET /api/v1/payments/pesapal/callback redirects to frontend progress page', async () => {
    const response = await request(app)
      .get('/api/v1/payments/pesapal/callback')
      .query({ OrderTrackingId: 'track-1', OrderMerchantReference: 'CERT-app-1' });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('http://localhost:5291/my-progress?payment=success');
    expect(CertificatePaymentService.processCallback).toHaveBeenCalled();
  });

  it('GET /api/v1/payments/pesapal/ipn returns Pesapal acknowledgement JSON', async () => {
    const response = await request(app)
      .get('/api/v1/payments/pesapal/ipn')
      .query({
        OrderTrackingId: 'track-1',
        OrderMerchantReference: 'CERT-app-1',
        OrderNotificationType: 'IPNCHANGE',
      });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId: 'track-1',
      orderMerchantReference: 'CERT-app-1',
      status: 200,
    });
  });

  it('POST /api/v1/payments/certificate initiates checkout for authenticated user', async () => {
    const response = await request(app).post('/api/v1/payments/certificate');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.redirectUrl).toContain('https://pay.pesapal.com/checkout');
  });
});
