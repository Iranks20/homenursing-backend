import axios from 'axios';
import { ENV_CONFIG } from '../config/environment';
import { logger } from '../utils/logger';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailInput {
  to: EmailRecipient;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  static isConfigured(): boolean {
    return Boolean(ENV_CONFIG.BREVO_API_KEY && ENV_CONFIG.BREVO_SENDER_EMAIL);
  }

  static async send(input: SendEmailInput): Promise<boolean> {
    if (!EmailService.isConfigured()) {
      logger.warn('Brevo email skipped — API key or sender email not configured', {
        to: input.to.email,
        subject: input.subject,
      });
      return false;
    }

    try {
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: {
            name: ENV_CONFIG.BREVO_SENDER_NAME,
            email: ENV_CONFIG.BREVO_SENDER_EMAIL,
          },
          to: [{ email: input.to.email, name: input.to.name ?? input.to.email }],
          subject: input.subject,
          htmlContent: input.html,
          textContent: input.text,
        },
        {
          headers: {
            'api-key': ENV_CONFIG.BREVO_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 15000,
        }
      );
      logger.info('Email sent via Brevo', { to: input.to.email, subject: input.subject });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Brevo email failed', { to: input.to.email, subject: input.subject, error: message });
      return false;
    }
  }
}

export default EmailService;
