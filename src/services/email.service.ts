import axios from 'axios';
import { ENV_CONFIG } from '../config/environment';
import { logger } from '../utils/logger';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendTemplateEmailInput {
  to: EmailRecipient;
  templateId: string;
  params: Record<string, string>;
}

export class EmailService {
  static isConfigured(): boolean {
    return Boolean(
      ENV_CONFIG.EMAILJS_SERVICE_ID &&
        ENV_CONFIG.EMAILJS_PUBLIC_KEY &&
        ENV_CONFIG.EMAILJS_PRIVATE_KEY
    );
  }

  static async sendTemplate(input: SendTemplateEmailInput): Promise<boolean> {
    if (!EmailService.isConfigured()) {
      logger.warn('EmailJS skipped — service/public/private key not configured', {
        to: input.to.email,
        templateId: input.templateId,
      });
      return false;
    }

    if (!input.templateId) {
      logger.warn('EmailJS skipped — template id missing', { to: input.to.email });
      return false;
    }

    try {
      const response = await axios.post(
        'https://api.emailjs.com/api/v1.0/email/send',
        {
          service_id: ENV_CONFIG.EMAILJS_SERVICE_ID,
          template_id: input.templateId,
          user_id: ENV_CONFIG.EMAILJS_PUBLIC_KEY,
          accessToken: ENV_CONFIG.EMAILJS_PRIVATE_KEY,
          template_params: {
            ...input.params,
            to_email: input.to.email,
            to_name: input.to.name ?? input.to.email,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
          validateStatus: () => true,
        }
      );

      if (response.status >= 200 && response.status < 300) {
        logger.info('Email sent via EmailJS', {
          to: input.to.email,
          templateId: input.templateId,
        });
        return true;
      }

      logger.error('EmailJS send failed', {
        to: input.to.email,
        templateId: input.templateId,
        status: response.status,
        error: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('EmailJS request failed', {
        to: input.to.email,
        templateId: input.templateId,
        error: message,
      });
      return false;
    }
  }
}

export default EmailService;
