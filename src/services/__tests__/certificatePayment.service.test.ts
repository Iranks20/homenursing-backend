import { CertificatePaymentStatus, NurseApplicationStatus } from '@prisma/client';
import CertificatePaymentService from '../certificatePayment.service';
import PesapalService from '../pesapal.service';

const nurseApplicationFindUnique = jest.fn();
const nurseCertificatePaymentFindFirst = jest.fn();

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    nurseApplication: { findUnique: (...args: unknown[]) => nurseApplicationFindUnique(...args) },
    nurseCertificatePayment: {
      findFirst: (...args: unknown[]) => nurseCertificatePaymentFindFirst(...args),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    trainingExamCertificate: { upsert: jest.fn(), update: jest.fn() },
    user: { update: jest.fn() },
    nurse: { upsert: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../pesapal.service', () => ({
  __esModule: true,
  default: {
    resolveNotificationId: jest.fn(),
    submitOrder: jest.fn(),
    getTransactionStatus: jest.fn(),
    isPaymentCompleted: jest.fn(),
  },
}));

jest.mock('../certificatePdf.service', () => ({
  __esModule: true,
  default: { generate: jest.fn().mockResolvedValue('/uploads/certificates/test.pdf') },
}));

jest.mock('../hiringEmail.service', () => ({
  __esModule: true,
  default: { sendCertified: jest.fn() },
}));

jest.mock('../../config/environment', () => ({
  ENV_CONFIG: {
    PESAPAL_CONSUMER_KEY: 'key',
    PESAPAL_CONSUMER_SECRET: 'secret',
    PESAPAL_CALLBACK_URL: 'http://localhost:3847/api/v1/payments/pesapal/callback',
    CERTIFICATE_FEE_AMOUNT: 150000,
    CERTIFICATE_FEE_CURRENCY: 'UGX',
    CERTIFICATE_FEE_DESCRIPTION: 'Nursing qualification certificate fee',
  },
}));

describe('CertificatePaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateForUser', () => {
    it('rejects payment before interview is passed', async () => {
      nurseApplicationFindUnique.mockResolvedValue({
        id: 'app-1',
        userId: 'user-1',
        status: NurseApplicationStatus.EXAM_PASSED,
        user: { id: 'user-1', name: 'Jane Doe', email: 'j@example.com', phone: '0700000000' },
      });

      await expect(CertificatePaymentService.initiateForUser('user-1')).rejects.toMatchObject({
        message: 'Certificate payment is only available after passing the physical interview',
        statusCode: 400,
      });
    });

    it('returns existing pending redirect url without creating a new order', async () => {
      nurseApplicationFindUnique.mockResolvedValue({
        id: 'app-1',
        userId: 'user-1',
        status: NurseApplicationStatus.INTERVIEW_PASSED,
        name: 'Jane Doe',
        email: 'j@example.com',
        phone: '0700000000',
        user: { id: 'user-1', name: 'Jane Doe', email: 'j@example.com', phone: '0700000000' },
      });
      nurseCertificatePaymentFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'pay-1',
          redirectUrl: 'https://pay.pesapal.com/checkout',
          amount: 150000,
          currency: 'UGX',
          merchantReference: 'CERT-app-1',
        });

      const result = await CertificatePaymentService.initiateForUser('user-1');

      expect(result.redirectUrl).toBe('https://pay.pesapal.com/checkout');
      expect(PesapalService.submitOrder).not.toHaveBeenCalled();
    });
  });

  describe('processCallback', () => {
    it('finalizes certification when Pesapal reports completed payment', async () => {
      const payment = {
        id: 'pay-1',
        applicationId: 'app-1',
        userId: 'user-1',
        status: CertificatePaymentStatus.PENDING,
        orderTrackingId: 'track-1',
        merchantReference: 'CERT-app-1',
      };

      nurseCertificatePaymentFindFirst.mockResolvedValue(payment);
      (PesapalService.getTransactionStatus as jest.Mock).mockResolvedValue({
        payment_status_description: 'Completed',
        payment_method: 'MPESA',
      });
      (PesapalService.isPaymentCompleted as jest.Mock).mockReturnValue(true);

      const finalizeSpy = jest
        .spyOn(CertificatePaymentService, 'finalizeSuccessfulPayment')
        .mockResolvedValue(payment as any);

      const result = await CertificatePaymentService.processCallback({
        orderMerchantReference: 'CERT-app-1',
        orderTrackingId: 'track-1',
      });

      expect(result.completed).toBe(true);
      expect(finalizeSpy).toHaveBeenCalledWith('pay-1', {
        orderTrackingId: 'track-1',
        paymentMethod: 'MPESA',
      });
    });
  });
});
