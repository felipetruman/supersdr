import { describe, expect, it } from 'vitest';
import {
  WebhookSignatureError,
  WebhookValidationError,
} from '../../../core/errors/provider-error.js';
import type { WebhookRequest } from '../../../core/providers/provider.interface.js';
import { WppConnectProvider } from '../../../adapters/wppconnect/wppconnect.provider.js';
import { SESSION, onMessageText } from './__fixtures__/wppconnect.fixtures.js';

function makeProvider(
  opts: Partial<{ webhookSecret: string; webhookSecretHeader: string }> = {},
) {
  return new WppConnectProvider({
    baseUrl: 'http://localhost:21465',
    session: SESSION,
    token: 'fake-token',
    ...opts,
  });
}

function makeReq(partial: Partial<WebhookRequest> = {}): WebhookRequest {
  return {
    headers: {},
    body: {},
    rawBody: '',
    query: {},
    ...partial,
  };
}

describe('WppConnectProvider.verifyWebhook', () => {
  it('faz bypass quando webhookSecret não está configurado', () => {
    const provider = makeProvider();
    expect(() => provider.verifyWebhook(makeReq())).not.toThrow();
  });

  it('aceita quando o header bate com o segredo (default header)', () => {
    const provider = makeProvider({ webhookSecret: 'super-secret' });
    expect(() =>
      provider.verifyWebhook(
        makeReq({ headers: { 'x-webhook-secret': 'super-secret' } }),
      ),
    ).not.toThrow();
  });

  it('aceita header customizado configurável', () => {
    const provider = makeProvider({
      webhookSecret: 's3cr3t',
      webhookSecretHeader: 'X-My-Secret',
    });
    expect(() =>
      provider.verifyWebhook(
        makeReq({ headers: { 'x-my-secret': 's3cr3t' } }),
      ),
    ).not.toThrow();
  });

  it('lança WebhookSignatureError quando o segredo não bate', () => {
    const provider = makeProvider({ webhookSecret: 'right' });
    expect(() =>
      provider.verifyWebhook(
        makeReq({ headers: { 'x-webhook-secret': 'wrong' } }),
      ),
    ).toThrow(WebhookSignatureError);
  });

  it('lança WebhookSignatureError quando o header está ausente', () => {
    const provider = makeProvider({ webhookSecret: 'right' });
    expect(() => provider.verifyWebhook(makeReq())).toThrow(
      WebhookSignatureError,
    );
  });

  it('aceita header como array (pega primeiro valor)', () => {
    const provider = makeProvider({ webhookSecret: 's3cr3t' });
    expect(() =>
      provider.verifyWebhook(
        makeReq({ headers: { 'x-webhook-secret': ['s3cr3t', 'other'] } }),
      ),
    ).not.toThrow();
  });
});

describe('WppConnectProvider.parseWebhook', () => {
  it('retorna NormalizedEvent para payload válido', () => {
    const provider = makeProvider();
    const events = provider.parseWebhook(makeReq({ body: onMessageText() }));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('message');
  });

  it('lança WebhookValidationError para body sem event', () => {
    const provider = makeProvider();
    expect(() =>
      provider.parseWebhook(makeReq({ body: { foo: 'bar' } })),
    ).toThrow(WebhookValidationError);
  });

  it('lança WebhookValidationError para body null', () => {
    const provider = makeProvider();
    expect(() => provider.parseWebhook(makeReq({ body: null }))).toThrow(
      WebhookValidationError,
    );
  });

  it('expõe name = "wppconnect"', () => {
    const provider = makeProvider();
    expect(provider.name).toBe('wppconnect');
  });
});
