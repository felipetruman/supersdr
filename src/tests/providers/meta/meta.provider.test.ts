import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { MetaProvider } from '../../../adapters/meta/meta.provider.js';
import {
  WebhookSignatureError,
  WebhookValidationError,
} from '../../../core/errors/provider-error.js';
import type { WebhookRequest } from '../../../core/providers/provider.interface.js';

const APP_SECRET = 'test-app-secret';
const VERIFY_TOKEN = 'verify-me';

function sign(rawBody: string, secret = APP_SECRET): string {
  return (
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  );
}

function makeProvider(fetchImpl?: typeof fetch): MetaProvider {
  return new MetaProvider({
    phoneNumberId: '123456',
    accessToken: 'token-abc',
    appSecret: APP_SECRET,
    verifyToken: VERIFY_TOKEN,
    fetchImpl,
  });
}

describe('MetaProvider', () => {
  describe('handleVerification', () => {
    it('retorna challenge quando mode=subscribe e token bate', () => {
      const provider = makeProvider();
      const req: WebhookRequest = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'challenge-123',
        },
        headers: {},
        body: {},
        rawBody: '',
      };
      expect(provider.handleVerification(req)).toBe('challenge-123');
    });

    it('retorna null quando token não bate', () => {
      const provider = makeProvider();
      const req: WebhookRequest = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong',
          'hub.challenge': 'challenge-123',
        },
        headers: {},
        body: {},
        rawBody: '',
      };
      expect(provider.handleVerification(req)).toBeNull();
    });

    it('retorna null quando mode não é subscribe', () => {
      const provider = makeProvider();
      const req: WebhookRequest = {
        query: {
          'hub.mode': 'unsubscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'challenge-123',
        },
        headers: {},
        body: {},
        rawBody: '',
      };
      expect(provider.handleVerification(req)).toBeNull();
    });

    it('retorna null quando challenge ausente mesmo com token correto', () => {
      const provider = makeProvider();
      const req: WebhookRequest = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
        },
        headers: {},
        body: {},
        rawBody: '',
      };
      expect(provider.handleVerification(req)).toBeNull();
    });
  });

  describe('verifyWebhook', () => {
    it('aceita assinatura válida', () => {
      const provider = makeProvider();
      const rawBody = JSON.stringify({ ok: true });
      const req: WebhookRequest = {
        query: {},
        headers: { 'x-hub-signature-256': sign(rawBody) },
        body: { ok: true },
        rawBody,
      };
      expect(() => provider.verifyWebhook(req)).not.toThrow();
    });

    it('aceita assinatura quando header vem como array', () => {
      const provider = makeProvider();
      const rawBody = JSON.stringify({ ok: true });
      const req: WebhookRequest = {
        query: {},
        headers: { 'x-hub-signature-256': [sign(rawBody)] },
        body: { ok: true },
        rawBody,
      };
      expect(() => provider.verifyWebhook(req)).not.toThrow();
    });

    it('lança WebhookSignatureError quando assinatura inválida', () => {
      const provider = makeProvider();
      const rawBody = JSON.stringify({ ok: true });
      const req: WebhookRequest = {
        query: {},
        headers: { 'x-hub-signature-256': 'sha256=invalid' },
        body: { ok: true },
        rawBody,
      };
      expect(() => provider.verifyWebhook(req)).toThrowError(
        WebhookSignatureError,
      );
    });

    it('lança WebhookSignatureError quando header ausente', () => {
      const provider = makeProvider();
      const req: WebhookRequest = {
        query: {},
        headers: {},
        body: {},
        rawBody: '{}',
      };
      expect(() => provider.verifyWebhook(req)).toThrowError(
        WebhookSignatureError,
      );
    });
  });

  describe('parseWebhook', () => {
    it('parseia payload válido em NormalizedEvent[]', () => {
      const provider = makeProvider();
      const body = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '551199999',
                    phone_number_id: '123456',
                  },
                  contacts: [
                    { profile: { name: 'Felipe' }, wa_id: '5547999999999' },
                  ],
                  messages: [
                    {
                      from: '5547999999999',
                      id: 'wamid.ABC',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Olá' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const req: WebhookRequest = {
        query: {},
        headers: {},
        body,
        rawBody: JSON.stringify(body),
      };
      const events = provider.parseWebhook(req);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });

    it('lança WebhookValidationError em payload inválido', () => {
      const provider = makeProvider();
      const req: WebhookRequest = {
        query: {},
        headers: {},
        body: { invalid: 'payload' },
        rawBody: '{}',
      };
      expect(() => provider.parseWebhook(req)).toThrowError(
        WebhookValidationError,
      );
    });
  });

  describe('sendMessage', () => {
    it('delega chamada ao MetaClient e retorna SendResult', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () =>
          JSON.stringify({
            messaging_product: 'whatsapp',
            contacts: [{ input: '5547999999999', wa_id: '5547999999999' }],
            messages: [{ id: 'wamid.SENT-123' }],
          }),
      }) as unknown as typeof fetch;

      const provider = makeProvider(fetchImpl);
      const result = await provider.sendMessage('5547999999999', {
        type: 'text',
        text: 'Oi!',
      });

      expect(result.providerMessageId).toBe('wamid.SENT-123');
      expect(fetchImpl).toHaveBeenCalledOnce();
    });
  });

  describe('name', () => {
    it('expõe name="meta"', () => {
      expect(makeProvider().name).toBe('meta');
    });
  });
});
