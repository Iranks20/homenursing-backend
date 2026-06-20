import request from 'supertest';

const passthrough = (_req: any, _res: any, next: any) => next();

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

jest.mock('../../services/hiringEmail.service', () => ({
  __esModule: true,
  default: {
    sendApplicationWelcome: jest.fn().mockResolvedValue(undefined),
  },
}));

const submitPublicApplication = jest.fn().mockResolvedValue({
  username: 'jane.doe',
  temporaryPassword: 'TempPass123!',
  applicationId: 'app-1',
  userId: 'user-1',
});

jest.mock('../../services/application.service', () => ({
  __esModule: true,
  default: {
    submitPublicApplication,
  },
  ApplicationService: {
    submitPublicApplication,
    getMyApplication: jest.fn(),
    listApplications: jest.fn(),
  },
}));

import app from '../../app';

describe('public nurse application', () => {
  beforeEach(() => {
    submitPublicApplication.mockClear();
  });

  it('accepts multipart apply with qualification drive link', async () => {
    const response = await request(app)
      .post('/api/v1/applications/public')
      .field('name', 'Jane Doe')
      .field('email', 'jane.doe.test@example.com')
      .field('phone', '+256700000099')
      .field('qualificationDriveLink', 'https://drive.google.com/file/d/abc/view');

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(submitPublicApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jane Doe',
        email: 'jane.doe.test@example.com',
        qualificationDriveLink: 'https://drive.google.com/file/d/abc/view',
      }),
      []
    );
  });
});
