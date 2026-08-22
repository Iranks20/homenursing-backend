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

export interface SendTemplateEmailInput {
  to: EmailRecipient;
  templateId: string;
  params: Record<string, string>;
}

export class EmailService {
  /** Whether EmailJS (the templated-email provider) has its keys configured. */
  static isConfigured(): boolean {
    return Boolean(
      ENV_CONFIG.EMAILJS_SERVICE_ID &&
        ENV_CONFIG.EMAILJS_PUBLIC_KEY &&
        ENV_CONFIG.EMAILJS_PRIVATE_KEY
    );
  }

  /** Whether Brevo (the raw-HTML email provider) has its keys configured. */
  static isBrevoConfigured(): boolean {
    return Boolean(ENV_CONFIG.BREVO_API_KEY && ENV_CONFIG.BREVO_SENDER_EMAIL);
  }

  /**
   * Send a fully custom HTML email via Brevo. Used by HiringEmailService for the
   * recruitment-pipeline emails (application received, exam result, interview
   * outcome, certified, recruited, etc.) which build their own HTML body per
   * message rather than relying on a pre-made template.
   *
   * Requires BREVO_API_KEY and BREVO_SENDER_EMAIL to be set in .env — until then
   * this logs a warning and returns false rather than sending (same as before).
   */
  static async send(input: SendEmailInput): Promise<boolean> {
    if (!EmailService.isBrevoConfigured()) {
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

  /**
   * Send a pre-made EmailJS template. Used where a specific EMAILJS_TEMPLATE_*
   * id has been configured in .env (currently just the nurse welcome email).
   */
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
