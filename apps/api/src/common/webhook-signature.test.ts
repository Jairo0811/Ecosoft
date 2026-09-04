import { signWebhookPayload, verifyWebhookSignature } from './webhook-signature';

describe('webhook signatures', () => {
  const secret = '0123456789abcdef0123456789abcdef';
  const body = JSON.stringify({ event: 'contract.updated', id: '123' });

  it('signs and verifies the exact payload', () => {
    const signed = signWebhookPayload(body, secret, 1_700_000_000);

    expect(
      verifyWebhookSignature({
        rawBody: body,
        secret,
        timestamp: signed.timestamp,
        signature: signed.signature,
        now: 1_700_000_100,
      }),
    ).toBe(true);
  });

  it('rejects modified payloads', () => {
    const signed = signWebhookPayload(body, secret, 1_700_000_000);

    expect(
      verifyWebhookSignature({
        rawBody: `${body} `,
        secret,
        timestamp: signed.timestamp,
        signature: signed.signature,
        now: 1_700_000_100,
      }),
    ).toBe(false);
  });

  it('rejects stale signatures to reduce replay risk', () => {
    const signed = signWebhookPayload(body, secret, 1_700_000_000);

    expect(
      verifyWebhookSignature({
        rawBody: body,
        secret,
        timestamp: signed.timestamp,
        signature: signed.signature,
        now: 1_700_001_000,
        toleranceSeconds: 300,
      }),
    ).toBe(false);
  });

  it('requires sufficiently strong webhook secrets', () => {
    expect(() => signWebhookPayload(body, 'short-secret', 1_700_000_000)).toThrow(/32/);
  });
});
