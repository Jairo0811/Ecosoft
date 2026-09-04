import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'v1=';

export interface SignedWebhook {
  timestamp: number;
  signature: string;
}

const signaturePayload = (timestamp: number, rawBody: string) => `${timestamp}.${rawBody}`;

export const signWebhookPayload = (
  rawBody: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): SignedWebhook => {
  if (secret.length < 32) {
    throw new Error('El secreto de webhook debe tener al menos 32 caracteres.');
  }

  const digest = createHmac('sha256', secret)
    .update(signaturePayload(timestamp, rawBody), 'utf8')
    .digest('hex');

  return { timestamp, signature: `${SIGNATURE_PREFIX}${digest}` };
};

export const verifyWebhookSignature = ({
  rawBody,
  secret,
  timestamp,
  signature,
  now = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
}: {
  rawBody: string;
  secret: string;
  timestamp: number;
  signature: string;
  now?: number;
  toleranceSeconds?: number;
}): boolean => {
  if (secret.length < 32 || toleranceSeconds < 0 || Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }
  if (!signature.startsWith(SIGNATURE_PREFIX)) return false;

  const expected = signWebhookPayload(rawBody, secret, timestamp).signature;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
};
