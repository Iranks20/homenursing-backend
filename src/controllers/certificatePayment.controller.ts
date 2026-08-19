import { Request, Response, NextFunction } from 'express';
import { ENV_CONFIG } from '../config/environment';
import CertificatePaymentService from '../services/certificatePayment.service';
import PesapalService from '../services/pesapal.service';
import { logger } from '../utils/logger';

function redirectToProgress(res: Response, status: 'success' | 'failed' | 'pending') {
  const target = `${ENV_CONFIG.APP_URL}/my-progress?payment=${status}`;
  res.redirect(302, target);
}

function ipnAck(query: Record<string, unknown>, status: number) {
  return {
    orderNotificationType: (query.OrderNotificationType as string) || 'IPNCHANGE',
    orderTrackingId: query.OrderTrackingId,
    orderMerchantReference: query.OrderMerchantReference,
    status,
  };
}

export class CertificatePaymentController {
  static async getPesapalHealth(_req: Request, res: Response, next: NextFunction) {
    try {
      const config = PesapalService.getConfigurationStatus();
      let auth: { ok: boolean; message: string } | null = null;
      if (ENV_CONFIG.PESAPAL_CONSUMER_KEY && ENV_CONFIG.PESAPAL_CONSUMER_SECRET) {
        try {
          auth = await PesapalService.verifyConnection();
        } catch (error) {
          auth = {
            ok: false,
            message: error instanceof Error ? error.message : 'Pesapal authentication failed',
          };
        }
      }
      res.status(200).json({
        success: true,
        data: {
          service: 'certificate-pesapal',
          config,
          auth,
          fee: {
            amount: ENV_CONFIG.CERTIFICATE_FEE_AMOUNT,
            currency: ENV_CONFIG.CERTIFICATE_FEE_CURRENCY,
            description: ENV_CONFIG.CERTIFICATE_FEE_DESCRIPTION,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async initiateMine(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await CertificatePaymentService.initiateForUser(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getMine(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const payment = await CertificatePaymentService.getLatestForUser(userId);
      res.status(200).json({
        success: true,
        data: {
          payment,
          fee: {
            amount: ENV_CONFIG.CERTIFICATE_FEE_AMOUNT,
            currency: ENV_CONFIG.CERTIFICATE_FEE_CURRENCY,
            description: ENV_CONFIG.CERTIFICATE_FEE_DESCRIPTION,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async handleCallback(req: Request, res: Response) {
    try {
      const orderTrackingId = (req.query.OrderTrackingId ?? req.query.orderTrackingId) as string | undefined;
      const orderMerchantReference = (req.query.OrderMerchantReference ?? req.query.orderMerchantReference) as
        | string
        | undefined;
      const callbackParams: { orderTrackingId?: string; orderMerchantReference?: string } = {};
      if (orderTrackingId) callbackParams.orderTrackingId = orderTrackingId;
      if (orderMerchantReference) callbackParams.orderMerchantReference = orderMerchantReference;
      const { completed } = await CertificatePaymentService.processCallback(callbackParams);
      redirectToProgress(res, completed ? 'success' : 'pending');
    } catch (error) {
      logger.error('Pesapal callback handling failed', { error });
      redirectToProgress(res, 'failed');
    }
  }

  static async handleIpn(req: Request, res: Response) {
    const fields = { ...req.query, ...(req.body && typeof req.body === 'object' ? req.body : {}) };
    try {
      const orderTrackingId = (req.query.OrderTrackingId ?? req.query.orderTrackingId) as string | undefined;
      const orderMerchantReference = (req.query.OrderMerchantReference ?? req.query.orderMerchantReference) as
        | string
        | undefined;
      const callbackParams: { orderTrackingId?: string; orderMerchantReference?: string } = {};
      if (orderTrackingId) callbackParams.orderTrackingId = orderTrackingId;
      if (orderMerchantReference) callbackParams.orderMerchantReference = orderMerchantReference;
      await CertificatePaymentService.processCallback(callbackParams);
      res.status(200).json(ipnAck(fields, 200));
    } catch (error) {
      logger.error('Pesapal IPN handling failed', { error });
      res.status(500).json(ipnAck(fields, 500));
    }
  }
}

export default CertificatePaymentController;
