import PesapalService, { PesapalTransactionStatus } from '../pesapal.service';

jest.mock('../../config/environment', () => ({
  ENV_CONFIG: {
    PESAPAL_CONSUMER_KEY: 'key',
    PESAPAL_CONSUMER_SECRET: 'secret',
    PESAPAL_ENV: 'sandbox',
    PESAPAL_IPN_NOTIFICATION_ID: '',
    PESAPAL_API_BASE_URL: 'https://cybqa.pesapal.com/pesapalv3/api',
    PESAPAL_CALLBACK_URL: 'http://localhost:3847/api/v1/payments/pesapal/callback',
    PESAPAL_IPN_URL: 'http://localhost:3847/api/v1/payments/pesapal/ipn',
    API_PUBLIC_URL: 'http://localhost:3847',
    PESAPAL_COUNTRY_CODE: 'UG',
  },
}));

describe('PesapalService', () => {
  describe('isPaymentCompleted', () => {
    it('returns true for completed descriptions and codes', () => {
      expect(
        PesapalService.isPaymentCompleted({
          payment_status_description: 'Completed',
          payment_status_code: 1,
        })
      ).toBe(true);
      expect(PesapalService.isPaymentCompleted({ payment_status_code: '1' })).toBe(true);
      expect(PesapalService.isPaymentCompleted({ status: '200' })).toBe(true);
    });

    it('returns false for pending or failed statuses', () => {
      const pending: PesapalTransactionStatus = {
        payment_status_description: 'Pending',
        payment_status_code: 0,
      };
      expect(PesapalService.isPaymentCompleted(pending)).toBe(false);
    });
  });

  describe('getConfigurationStatus', () => {
    it('reports missing notification id and localhost api url', () => {
      const status = PesapalService.getConfigurationStatus();
      expect(status.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('PESAPAL_IPN_NOTIFICATION_ID'),
          expect.stringContaining('localhost'),
        ])
      );
      expect(status.configured).toBe(false);
      expect(status.callbackUrl).toContain('/api/v1/payments/pesapal/callback');
      expect(status.ipnUrl).toContain('/api/v1/payments/pesapal/ipn');
    });
  });
});
