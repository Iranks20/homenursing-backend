import { logger } from '../utils/logger';

export interface EgoSmsConfig {
  apiUrl: string;
  username: string;
  password: string;
  senderId: string;
  priority: string;
  enabled: boolean;
}

export interface EgoSmsSendInput {
  to: string;
  message: string;
  senderId?: string;
  priority?: string;
}

export interface EgoSmsSendResult {
  ok: boolean;
  status: string;
  message: string;
  provider: 'egosms';
  to: string;
  sentAt: string;
  raw?: unknown;
}

const DEFAULT_API_URL = 'https://comms.egosms.co/api/v1/json/';
const UG_COUNTRY_CODE = '256';

const truthy = (value: string | undefined): boolean => {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

export const loadEgoSmsConfig = (): EgoSmsConfig => ({
  apiUrl: process.env.EGOSMS_API_URL || DEFAULT_API_URL,
  username: process.env.EGOSMS_USERNAME || '',
  password: process.env.EGOSMS_PASSWORD || '',
  senderId: process.env.EGOSMS_SENDER_ID || 'Homecare',
  priority: process.env.EGOSMS_PRIORITY || '0',
  enabled: truthy(process.env.EGOSMS_ENABLED),
});

export const normalizePhoneNumber = (raw: string): string => {
  const digits = (raw || '').replace(/[^0-9+]/g, '').replace(/^\+/, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('00')) {
    return digits.slice(2);
  }

  if (digits.startsWith('256')) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length >= 10) {
    return `${UG_COUNTRY_CODE}${digits.slice(1)}`;
  }

  if (/^[7]\d{8}$/.test(digits)) {
    return `${UG_COUNTRY_CODE}${digits}`;
  }

  return digits;
};

export const isLikelyValidPhone = (phone: string): boolean => {
  if (!phone) return false;
  if (phone.startsWith(UG_COUNTRY_CODE)) {
    return /^256[1-9]\d{8}$/.test(phone);
  }
  return /^[1-9]\d{7,14}$/.test(phone);
};

const INVALID_PHONE_MESSAGE =
  'Invalid phone number. Please use a 10-digit Uganda mobile number (e.g., 0771234567).';

export class EgoSmsService {
  static async sendOne(input: EgoSmsSendInput): Promise<EgoSmsSendResult> {
    const config = loadEgoSmsConfig();
    const number = normalizePhoneNumber(input.to);
    const sentAt = new Date().toISOString();

    if (!isLikelyValidPhone(number)) {
      logger.warn('SMS skipped - invalid phone number', { to: input.to, normalized: number });
      return {
        ok: false,
        status: 'INVALID_PHONE',
        message: INVALID_PHONE_MESSAGE,
        provider: 'egosms',
        to: number,
        sentAt,
      };
    }

    if (!config.enabled || !config.username || !config.password) {
      logger.info('SMS suppressed (provider disabled or missing credentials)', {
        to: number,
        length: input.message.length,
      });
      return {
        ok: true,
        status: 'SUPPRESSED',
        message: 'SMS provider not configured; message logged only',
        provider: 'egosms',
        to: number,
        sentAt,
      };
    }

    const payload = {
      method: 'SendSms',
      userdata: {
        username: config.username,
        password: config.password,
      },
      msgdata: [
        {
          number,
          message: input.message,
          senderid: input.senderId || config.senderId,
          priority: input.priority || config.priority,
        },
      ],
    };

    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      const status = extractStatus(parsed);
      const providerMessage = extractMessage(parsed);
      const ok = response.ok && /^(OK|SUCCESS|SENT)$/i.test(status);

      if (!ok) {
        logger.warn('SMS provider returned non-OK status', {
          status,
          providerMessage,
          raw: parsed,
          httpStatus: response.status,
        });
      } else {
        logger.info('SMS sent', { to: number, status });
      }

      const friendlyStatus = ok ? 'SENT' : mapStatusToCode(status, response.status);
      const friendlyMessage = ok ? 'Delivered' : sanitizeMessage(providerMessage, friendlyStatus);

      return {
        ok,
        status: friendlyStatus,
        message: friendlyMessage,
        provider: 'egosms',
        to: number,
        sentAt,
        raw: parsed,
      };
    } catch (error) {
      logger.error('SMS send failed', { error: error instanceof Error ? error.message : String(error) });
      return {
        ok: false,
        status: 'NETWORK_ERROR',
        message: 'SMS service is unreachable. Please try again shortly.',
        provider: 'egosms',
        to: number,
        sentAt,
      };
    }
  }

  static async sendMany(inputs: EgoSmsSendInput[]): Promise<EgoSmsSendResult[]> {
    const results: EgoSmsSendResult[] = [];
    for (const input of inputs) {
      const result = await this.sendOne(input);
      results.push(result);
    }
    return results;
  }
}

const extractStatus = (parsed: unknown): string => {
  if (!parsed) return '';
  if (typeof parsed === 'string') return parsed.split(/\s+/)[0] ?? '';
  if (typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const candidates = [obj.Status, obj.status, obj.code, obj.Code];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    }
    const msgdata = obj.msgdata ?? obj.MsgData;
    if (Array.isArray(msgdata) && msgdata.length > 0) {
      const first = msgdata[0] as Record<string, unknown>;
      const nested = first?.Status ?? first?.status;
      if (typeof nested === 'string') return nested;
    }
  }
  return '';
};

const mapStatusToCode = (rawStatus: string, httpStatus: number): string => {
  const normalized = (rawStatus || '').toUpperCase();
  if (!normalized) return httpStatus >= 200 && httpStatus < 300 ? 'FAILED' : `HTTP_${httpStatus}`;
  if (/FAIL|REJECT/.test(normalized)) return 'FAILED';
  if (/INVALID/.test(normalized)) return 'INVALID';
  return normalized;
};

const SANITIZE_RULES: { match: RegExp; message: string }[] = [
  {
    match: /money\s*not\s*enough|insufficient\s*(funds|balance|credit)|low\s*balance/i,
    message:
      'SMS credit balance is too low to send this batch. Please top up before retrying.',
  },
  {
    match: /(user|account)\s+(does\s*not\s*exist|not\s*active|inactive|disabled)/i,
    message:
      'SMS service authentication failed. Please contact your administrator.',
  },
  {
    match: /username\s*or\s*password\s*not\s*set|invalid\s*credentials|unauthor/i,
    message:
      'SMS service is not configured correctly. Please contact your administrator.',
  },
  {
    match:
      /invalid\s*(number|phone|msisdn|recipient|destination)|wrong\s*number|bad\s*number|number\s*not\s*valid|incorrect\s*number|number\s*(format|length)|msisdn\s*(format|length)|phone.*invalid|invalid\s*format/i,
    message: INVALID_PHONE_MESSAGE,
  },
  {
    match: /sender\s*id|senderid/i,
    message:
      'The sender ID is not approved yet. Please contact your administrator.',
  },
  {
    match: /quota|rate\s*limit|throttle|too\s*many\s*requests/i,
    message: 'Too many messages right now. Please try again in a moment.',
  },
  {
    match: /(message|sms|content).*(too\s*long|exceed|max\s*length)/i,
    message:
      'The message is too long. Please shorten it and try again.',
  },
  {
    match: /(message|sms|content)\s*(empty|missing|required)/i,
    message: 'The message body is empty.',
  },
  {
    match: /network|timeout|connection|service\s*unavailable/i,
    message: 'SMS service is temporarily unavailable. Please try again shortly.',
  },
  {
    match: /blacklist|do\s*not\s*disturb|opted\s*out|opt-?out/i,
    message: 'This recipient has opted out of SMS messages.',
  },
];

const sanitizeMessage = (providerMessage: string, fallbackStatus: string): string => {
  const trimmed = (providerMessage || '').trim();
  if (trimmed) {
    for (const rule of SANITIZE_RULES) {
      if (rule.match.test(trimmed)) return rule.message;
    }
  }

  if (fallbackStatus === 'INVALID' || fallbackStatus === 'INVALID_PHONE') {
    return INVALID_PHONE_MESSAGE;
  }
  if (fallbackStatus === 'NETWORK_ERROR' || fallbackStatus.startsWith('HTTP_')) {
    return 'SMS service is temporarily unavailable. Please try again shortly.';
  }
  return 'SMS could not be delivered. Please try again.';
};

const extractMessage = (parsed: unknown): string => {
  if (!parsed) return '';
  if (typeof parsed === 'string') return parsed.trim();
  if (typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const candidates = [obj.Message, obj.message, obj.Error, obj.error, obj.description];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    }
    const msgdata = obj.msgdata ?? obj.MsgData;
    if (Array.isArray(msgdata) && msgdata.length > 0) {
      const first = msgdata[0] as Record<string, unknown>;
      const nested = first?.Message ?? first?.message;
      if (typeof nested === 'string') return nested;
    }
  }
  return '';
};
