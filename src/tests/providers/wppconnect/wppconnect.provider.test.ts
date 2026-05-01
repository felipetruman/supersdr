import { describe, expect, it } from 'vitest';
import {
  WebhookSignatureError,
  WebhookValidationError,
} from '../../../core/errors/provider-error.js';
import { WppConnectProvider } from '../../../adapters/wppconnect/wppconnect.provider.js';
import { SESSION, onMessageText } from './__fixtures__/wppconnect.fixtures.js';

function makeProvider(opts: Partial<{ webhookSecret: string; webhookSecretHeader: string }> = {}) {
  return new WppConnectProvider({
    baseUrl: 'http://localhost:21465',
    session: SESSION,
    token: 'fake-token',
    ...opts,
  });
}

describe('WppConnectProvider.verifyWebhook', () => {
  it('faz bypass quando webhookSecret não está configurado', () => {
    const provider = makeProvider();
    expect(() => provider.verifyWebhook({ headers: {}, body: {} })).not.toThrow();
  });

  it('aceita quando o header bate com o segredo (default header)', () => {
    const provider = makeProvider({ webhookSecret: 'super-secret' });
    expect(() =>
      provider.verifyWebhook({
        headers: { 'x-webhook-secret': 'super-secret' },
        body: {},
      }),
    ).not.toThrow();
  });

  it('aceita header customizado configurável', () => {
    const provider = makeProvider({
      webhookSecret: 's3cr3t',
      webhookSecretHeader: 'X-My-Secret',
    });
    expect(() =>
      provider.verifyWebhook({
        headers: { 'x-my-secret': 's3cr3t' },
        body: {},
      }),
    ).not.toThrow();
  });

  it('lança WebhookSignatureError quando o segredo não bate', () => {
    const provider = makeProvider({ webhookSecret: 'right' });
    expect(() =>
      provider.verifyWebhook({
        headers: { 'x-webhook-secret': 'wrong' },
        body: {},
      }),
    ).toThrow(WebhookSignatureError);
  });

  it('lança WebhookSignatureError quando o header está ausente', () => {
    const provider = makeProvider({ webhookSecret: 'right' });
    expect(() => provider.verifyWebhook({ headers: {}, body: {} })).toThrow(
      WebhookSignatureError,
    );
  });

  it('aceita header como array (pega primeiro valor)', () => {
    const provider = makeProvider({ webhookSecret: 's3cr3t' });
    expect(() =>
      provider.verifyWebhook({
        headers: { 'x-webhook-secret': ['s3cr3t', 'other'] },
        body: {},
      }),
    ).not.toThrow();
  });
});

describe('WppConnectProvider.parseWebhook', () => {
  it('retorna NormalizedEvent para payload válido', () => {
    const provider = makeProvider();
    const events = provider.parseWebhook({
      headers: {},
      body: onMessageText(),
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('message');
  });

  it('lança WebhookValidationError para body sem event', () => {
    const provider = makeProvider();
    expect(() =>
      provider.parseWebhook({ headers: {}, body: { foo: 'bar' } }),
    ).toThrow(WebhookValidationError);
  });

  it('lança WebhookValidationError para body null', () => {
    const provider = makeProvider();
    expect(() => provider.parseWebhook({ headers: {}, body: null })).toThrow(
      WebhookValidationError,
    );
  });

  it('expõe name = "wppconnect"', () => {
    const provider = makeProvider();
    expect(provider.name).toBe('wppconnect');
  });
});
