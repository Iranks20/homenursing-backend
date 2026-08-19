import axios, { AxiosInstance } from 'axios';
import { ENV_CONFIG } from '../config/environment';
import { logger } from '../utils/logger';

interface PesapalAuthResponse {
  token: string;
  expiryDate: string;
  error?: unknown;
  status?: string;
  message?: string;
}

interface PesapalIpnResponse {
  url: string;
  created_date: string;
  ipn_id: string;
  error?: unknown;
  status?: string;
}

interface PesapalSubmitOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  error?: unknown;
  status?: string;
  message?: string;
}

export interface PesapalTransactionStatus {
  payment_status_description?: string;
  payment_status_code?: number | string;
  status?: string;
  message?: string;
  payment_method?: string;
  amount?: number;
  currency?: string;
  merchant_reference?: string;
}

export class PesapalService {
  private static token: string | null = null;
  private static tokenExpiresAt = 0;

  private static get client(): AxiosInstance {
    return axios.create({
      baseURL: ENV_CONFIG.PESAPAL_API_BASE_URL,
      timeout: 30000,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  }

  private static async getAuthToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt - 60_000) {
      return this.token;
    }

    const response = await this.client.post<PesapalAuthResponse>('/Auth/RequestToken', {
      consumer_key: ENV_CONFIG.PESAPAL_CONSUMER_KEY,
      consumer_secret: ENV_CONFIG.PESAPAL_CONSUMER_SECRET,
    });

    const token = response.data?.token;
    if (!token) {
      throw new Error(response.data?.message?.toString() || 'Failed to authenticate with Pesapal');
    }

    this.token = token;
    const expiry = response.data.expiryDate ? Date.parse(response.data.expiryDate) : now + 4 * 60_000;
    this.tokenExpiresAt = Number.isNaN(expiry) ? now + 4 * 60_000 : expiry;
    return token;
  }

  private static async authorizedPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const token = await this.getAuthToken();
    const response = await this.client.post<T>(path, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  private static async authorizedGet<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getAuthToken();
    const response = await this.client.get<T>(path, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  static async registerIpn(url: string): Promise<string> {
    const data = await this.authorizedPost<PesapalIpnResponse>('/URLSetup/RegisterIPN', {
      url,
      ipn_notification_type: 'GET',
    });
    if (!data.ipn_id) {
      throw new Error('Pesapal IPN registration did not return ipn_id');
    }
    logger.info('Pesapal IPN registered', { ipnId: data.ipn_id, url });
    return data.ipn_id;
  }

  static async resolveNotificationId(): Promise<string> {
    if (ENV_CONFIG.PESAPAL_IPN_NOTIFICATION_ID) {
      return ENV_CONFIG.PESAPAL_IPN_NOTIFICATION_ID;
    }
    const ipnId = await this.registerIpn(ENV_CONFIG.PESAPAL_IPN_URL);
    logger.warn('Pesapal IPN ID generated at runtime; set PESAPAL_IPN_NOTIFICATION_ID in env to reuse it', {
      ipnId,
    });
    return ipnId;
  }

  static async submitOrder(input: {
    merchantReference: string;
    amount: number;
    currency: string;
    description: string;
    callbackUrl: string;
    notificationId: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
  }): Promise<{ orderTrackingId: string; redirectUrl: string }> {
    const data = await this.authorizedPost<PesapalSubmitOrderResponse>('/Transactions/SubmitOrderRequest', {
      id: input.merchantReference,
      currency: input.currency,
      amount: input.amount,
      description: input.description,
      callback_url: input.callbackUrl,
      notification_id: input.notificationId,
      billing_address: {
        email_address: input.email,
        phone_number: input.phone,
        country_code: ENV_CONFIG.PESAPAL_COUNTRY_CODE,
        first_name: input.firstName,
        middle_name: '',
        last_name: input.lastName,
        line_1: '',
        line_2: '',
        city: '',
        state: '',
        postal_code: '',
        zip_code: '',
      },
    });

    if (!data.order_tracking_id || !data.redirect_url) {
      throw new Error(data.message?.toString() || 'Pesapal did not return a payment redirect URL');
    }

    return {
      orderTrackingId: data.order_tracking_id,
      redirectUrl: data.redirect_url,
    };
  }

  static async getTransactionStatus(orderTrackingId: string): Promise<PesapalTransactionStatus> {
    return this.authorizedGet<PesapalTransactionStatus>('/Transactions/GetTransactionStatus', {
      orderTrackingId,
    });
  }

  static isPaymentCompleted(status: PesapalTransactionStatus): boolean {
    const description = status.payment_status_description?.toLowerCase() ?? '';
    const code = String(status.payment_status_code ?? '');
    return description.includes('completed') || code === '1' || status.status === '200';
  }

  static getConfigurationStatus(): {
    configured: boolean;
    env: string;
    apiBaseUrl: string;
    callbackUrl: string;
    ipnUrl: string;
    issues: string[];
  } {
    const issues: string[] = [];
    if (!ENV_CONFIG.PESAPAL_CONSUMER_KEY) {
      issues.push('Missing PESAPAL_CONSUMER_KEY');
    }
    if (!ENV_CONFIG.PESAPAL_CONSUMER_SECRET) {
      issues.push('Missing PESAPAL_CONSUMER_SECRET');
    }
    if (!ENV_CONFIG.PESAPAL_IPN_NOTIFICATION_ID) {
      issues.push('Missing PESAPAL_IPN_NOTIFICATION_ID (auto-registered on first checkout if IPN URL is public)');
    }
    if (!ENV_CONFIG.API_PUBLIC_URL) {
      issues.push('Missing API_PUBLIC_URL');
    } else if (/localhost|127\.0\.0\.1/i.test(ENV_CONFIG.API_PUBLIC_URL)) {
      issues.push('API_PUBLIC_URL is localhost — Pesapal IPN/callback will not reach this server from the internet');
    }
    return {
      configured: issues.length === 0,
      env: ENV_CONFIG.PESAPAL_ENV,
      apiBaseUrl: ENV_CONFIG.PESAPAL_API_BASE_URL,
      callbackUrl: ENV_CONFIG.PESAPAL_CALLBACK_URL,
      ipnUrl: ENV_CONFIG.PESAPAL_IPN_URL,
      issues,
    };
  }

  static async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    await this.getAuthToken();
    return { ok: true, message: 'Pesapal authentication succeeded' };
  }
}

export default PesapalService;
