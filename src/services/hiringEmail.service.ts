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

function layout(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
  <div style="border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:20px;color:#111827;">Teamwork Home Nursing</h1>
  </div>
  ${body}
  <p style="margin-top:32px;font-size:12px;color:#6b7280;">This is an automated message from Teamwork Home Nursing.</p>
</body>
</html>`;
}

export class HiringEmailService {
  static async sendApplicationWelcome(input: {
    name: string;
    email: string;
    username: string;
    temporaryPassword: string;
  }): Promise<boolean> {
    const body = `
      <p>Dear ${input.name},</p>
      <p>Thank you for applying to join our home nursing team. Your account has been created.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Username:</strong> ${input.username}</p>
        <p style="margin:0;"><strong>Temporary password:</strong> ${input.temporaryPassword}</p>
      </div>
      <p><strong>Next steps:</strong></p>
      <ol>
        <li>Log in and change your password after first sign-in</li>
        <li>Complete the online qualification exam</li>
        <li>Book your physical interview after passing the exam</li>
      </ol>
      <p><a href="${loginUrl()}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Sign in to your account</a></p>
    `;
    return EmailService.send({
      to: { email: input.email, name: input.name },
      subject: 'Your nurse application account is ready',
      html: layout('Application received', body),
      text: `Dear ${input.name}, your account is ready. Username: ${input.username}. Temporary password: ${input.temporaryPassword}. Sign in at ${loginUrl()}`,
    });
  }

  static async sendExamPassed(input: { name: string; email: string }): Promise<boolean> {
    const body = `
      <p>Dear ${input.name},</p>
      <p>Congratulations — you passed the qualification exam.</p>
      <p>Your next step is to book a date for your physical interview when you are available.</p>
      <p><a href="${progressUrl()}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Book your interview</a></p>
    `;
    return EmailService.send({
      to: { email: input.email, name: input.name },
      subject: 'Qualification exam passed — book your interview',
      html: layout('Exam passed', body),
      text: `Dear ${input.name}, you passed the qualification exam. Book your interview at ${progressUrl()}`,
    });
  }

  static async sendExamFailed(input: { name: string; email: string }): Promise<boolean> {
    const body = `
      <p>Dear ${input.name},</p>
      <p>Unfortunately you did not pass the qualification exam on this attempt.</p>
      <p>Please contact our training team if you need guidance or wish to discuss next steps.</p>
    `;
    return EmailService.send({
      to: { email: input.email, name: input.name },
      subject: 'Qualification exam result',
      html: layout('Exam result', body),
      text: `Dear ${input.name}, you did not pass the qualification exam on this attempt.`,
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
    const body = `
      <p>Dear ${input.name},</p>
      <p>Your physical interview has been booked.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;"><strong>Date & time:</strong> ${when}</p>
      </div>
      <p>Please arrive on time and bring any required documents. You will be notified after the interview is reviewed.</p>
      <p><a href="${progressUrl()}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">View your progress</a></p>
    `;
    return EmailService.send({
      to: { email: input.email, name: input.name },
      subject: 'Physical interview confirmed',
      html: layout('Interview booked', body),
      text: `Dear ${input.name}, your interview is booked for ${when}.`,
    });
  }

  static async sendInterviewFailed(input: { name: string; email: string }): Promise<boolean> {
    const body = `
      <p>Dear ${input.name},</p>
      <p>Thank you for attending your physical interview. After review, we are unable to proceed with your application at this time.</p>
      <p>We appreciate your interest in Teamwork Home Nursing and wish you the best.</p>
    `;
    return EmailService.send({
      to: { email: input.email, name: input.name },
      subject: 'Interview outcome',
      html: layout('Interview outcome', body),
      text: `Dear ${input.name}, we are unable to proceed with your application at this time.`,
    });
  }

  static async sendCertified(input: { name: string; email: string }): Promise<boolean> {
    const body = `
      <p>Dear ${input.name},</p>
      <p>Congratulations — you passed your physical interview and have been certified.</p>
      <p>Your certificate has been issued. Our team will complete your recruitment onboarding shortly. Once recruitment is confirmed, you will gain access to patient assignments.</p>
      <p><a href="${trainingUrl()}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">View your certificate</a></p>
    `;
    return EmailService.send({
      to: { email: input.email, name: input.name },
      subject: 'Certified — recruitment onboarding pending',
      html: layout('Certified', body),
      text: `Dear ${input.name}, you are certified. Recruitment onboarding is pending.`,
    });
  }

  static async sendRecruited(input: { name: string; email: string }): Promise<boolean> {
    const body = `
      <p>Dear ${input.name},</p>
      <p>Welcome to Teamwork Home Nursing — your recruitment is complete.</p>
      <p>You now have full access to patient records and clinical documentation. You may begin your nursing duties.</p>
      <p><a href="${loginUrl()}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Go to dashboard</a></p>
    `;
    return EmailService.send({
      to: { email: input.email, name: input.name },
      subject: 'Welcome aboard — you are now recruited',
      html: layout('Recruited', body),
      text: `Dear ${input.name}, your recruitment is complete. Sign in at ${loginUrl()}`,
    });
  }
}

export default HiringEmailService;
