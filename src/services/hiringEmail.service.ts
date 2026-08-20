import { ENV_CONFIG } from '../config/environment';
import EmailService from './email.service';

function loginUrl(): string {
  return `${ENV_CONFIG.APP_URL}/`;
}

function progressUrl(): string {
  return `${ENV_CONFIG.APP_URL}/my-progress`;
}

function trainingUrl(): string {
  return `${ENV_CONFIG.APP_URL}/training`;
}

async function sendHiringTemplate(
  templateId: string,
  to: { email: string; name: string },
  params: Record<string, string>
): Promise<boolean> {
  if (!templateId) {
    return false;
  }
  return EmailService.sendTemplate({
    to: { email: to.email, name: to.name },
    templateId,
    params: {
      candidate_name: to.name,
      login_url: loginUrl(),
      progress_url: progressUrl(),
      training_url: trainingUrl(),
      ...params,
    },
  });
}

export class HiringEmailService {
  static async sendApplicationWelcome(input: {
    name: string;
    email: string;
    username: string;
    temporaryPassword: string;
  }): Promise<boolean> {
    return sendHiringTemplate(ENV_CONFIG.EMAILJS_TEMPLATE_NURSE_WELCOME, input, {
      username: input.username,
      temporary_password: input.temporaryPassword,
      subject: 'Your Teamwork Home Nursing login details',
    });
  }

  static async sendExamPassed(input: { name: string; email: string }): Promise<boolean> {
    return sendHiringTemplate(ENV_CONFIG.EMAILJS_TEMPLATE_EXAM_PASSED, input, {
      subject: 'Qualification exam passed — book your interview',
    });
  }

  static async sendExamFailed(input: { name: string; email: string }): Promise<boolean> {
    return sendHiringTemplate(ENV_CONFIG.EMAILJS_TEMPLATE_EXAM_FAILED, input, {
      subject: 'Qualification exam result',
    });
  }

  static async sendInterviewBooked(input: {
    name: string;
    email: string;
    scheduledAt: Date;
  }): Promise<boolean> {
    const when = input.scheduledAt.toLocaleString('en-GB', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    return sendHiringTemplate(ENV_CONFIG.EMAILJS_TEMPLATE_INTERVIEW_BOOKED, input, {
      interview_datetime: when,
      subject: 'Physical interview confirmed',
    });
  }

  static async sendInterviewFailed(input: { name: string; email: string }): Promise<boolean> {
    return sendHiringTemplate(ENV_CONFIG.EMAILJS_TEMPLATE_INTERVIEW_FAILED, input, {
      subject: 'Interview outcome',
    });
  }

  static async sendInterviewPassed(input: { name: string; email: string }): Promise<boolean> {
    return sendHiringTemplate(ENV_CONFIG.EMAILJS_TEMPLATE_INTERVIEW_PASSED, input, {
      subject: 'Interview passed — pay for your certificate',
    });
  }

  static async sendCertified(input: { name: string; email: string }): Promise<boolean> {
    return sendHiringTemplate(ENV_CONFIG.EMAILJS_TEMPLATE_CERTIFIED, input, {
      subject: 'Certified — recruitment onboarding pending',
    });
  }

  static async sendRecruited(input: { name: string; email: string }): Promise<boolean> {
    return sendHiringTemplate(ENV_CONFIG.EMAILJS_TEMPLATE_RECRUITED, input, {
      subject: 'Welcome aboard — you are now recruited',
    });
  }
}

export default HiringEmailService;
