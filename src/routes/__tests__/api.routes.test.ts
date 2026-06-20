import request from 'supertest';

const passthrough = (_req: any, _res: any, next: any) => next();
const passthroughFactory = () => passthrough;

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-admin', role: 'ADMIN' };
    next();
  },
  optionalAuth: passthrough,
  requireRole: () => passthrough,
  requireAdmin: passthrough,
  requireStaff: passthrough,
  requireMedicalStaff: passthrough,
  requireSpecialistsAndTherapists: passthrough,
  requireReceptionistOrAdmin: passthrough,
  requireReceptionistAdminOrBiller: passthrough,
  requireAdminOrBiller: passthrough,
  requireOwnership: () => passthrough,
  requireSelfOrAdmin: () => passthrough,
  requireEmailVerification: passthrough,
  authorize: () => passthrough,
  logAuthEvent: () => passthrough,
  authRateLimit: {},
}));

jest.mock('../../middleware/clinicalAccess.middleware', () => ({
  requireClinicalAccess: (_req: any, _res: any, next: any) => next(),
  hasClinicalAccess: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../services/lab.service', () => ({
  LabService: {
    getLabSamples: jest.fn().mockResolvedValue({
      samples: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    getLabResults: jest.fn().mockResolvedValue({ results: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
  },
  ReferralService: {
    getReferrals: jest.fn().mockResolvedValue({
      referrals: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
  },
}));

jest.mock('../../services/patient.service', () => ({
  PatientService: {
    getPatients: jest.fn().mockResolvedValue({
      patients: [{ id: 'p1', name: 'Test Patient' }],
      pagination: { page: 1, limit: 200, total: 1, totalPages: 1 },
    }),
  },
}));

jest.mock('../../services/supervision.service', () => ({
  __esModule: true,
  default: {
    listAssignments: jest.fn().mockResolvedValue({
      assignments: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    }),
    listReports: jest.fn().mockResolvedValue({
      reports: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    }),
  },
}));

import app from '../../app';

describe('registered API routes', () => {
  it('GET /api/v1/patients accepts limit up to 200', async () => {
    const response = await request(app).get('/api/v1/patients?page=1&limit=200');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('GET /api/v1/patients rejects limit above 200 with 400', async () => {
    const response = await request(app).get('/api/v1/patients?page=1&limit=500');
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(String(response.body.error?.message ?? '')).toMatch(/limit/i);
  });

  it('GET /api/v1/lab/samples is registered', async () => {
    const response = await request(app).get('/api/v1/lab/samples?limit=20');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('GET /api/v1/referrals is registered', async () => {
    const response = await request(app).get('/api/v1/referrals?limit=20');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('GET /api/v1/supervision/assignments is registered', async () => {
    const response = await request(app).get('/api/v1/supervision/assignments?limit=100');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
