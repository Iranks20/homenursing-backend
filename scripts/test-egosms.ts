import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const apiUrl = process.env.EGOSMS_API_URL || 'https://www.egosms.co/api/v1/json/';
const username = process.env.EGOSMS_USERNAME || '';
const password = process.env.EGOSMS_PASSWORD || '';
const senderId = process.env.EGOSMS_SENDER_ID || 'Homecare';

const to = process.argv[2] || '256771289654';
const messageBody =
  process.argv.slice(3).join(' ') || 'Test message from Teamwork Physiotherapy via EgoSMS.';

const normalize = (raw: string): string => {
  const digits = raw.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('256')) return digits;
  if (digits.startsWith('0') && digits.length >= 10) return `256${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `256${digits}`;
  return digits;
};

const number = normalize(to);

const payload = {
  method: 'SendSms',
  userdata: { username, password },
  msgdata: [{ number, message: messageBody, senderid: senderId, priority: '0' }],
};

async function main() {
  console.log('=== EgoSMS direct test ===');
  console.log('Endpoint:', apiUrl);
  console.log('Username present?', Boolean(username), 'length:', username.length);
  console.log('Password present?', Boolean(password), 'length:', password.length);
  console.log('Sender ID:', senderId);
  console.log('Normalized recipient:', number);
  console.log('Body:', messageBody);
  console.log('Payload being sent:', {
    ...payload,
    userdata: { username, password: password ? `***${password.slice(-4)}` : '' },
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  console.log('--- Response ---');
  console.log('HTTP status:', response.status, response.statusText);
  try {
    console.log('Parsed JSON:', JSON.parse(text));
  } catch {
    console.log('Raw body:', text);
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exitCode = 1;
});
