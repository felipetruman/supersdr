import { describe, it, expect, vi } from 'vitest';
import { WppConnectProvider } from '../../../adapters/wppconnect/wppconnect.provider.js';
import { WebhookSignatureError } from '../../../core/errors/provider-error.js';
import type { WebhookRequest } from '../../../core/providers/provider.interface.js';

function makeProvider(fetchImpl?: typeof fetch, webhookSecret?: string) {
  return new WppConnectProvider({
    baseUrl: 'http://wpp.test',
    session: 'sess',
    token: 'tok',
    fetchImpl,
    webhookSecret,
  });
}

describe('WppConnectProvider — gaps', () => {
  it('verifyWebhook bypass quando webhookSecret não configurado', () => {
    const p = makeProvider();
    expect(() =>
      p.verifyWebhook({ headers: {}, body: {}, query: {}, rawBody: '' }),
    ).not.toThrow();
  });

  it('verifyWebhook aceita header igual ao secret', () => {
    const p = makeProvider(undefined, 'top-secret');
    expect(() =>
      p.verifyWebhook({
        headers: { 'x-webhook-secret': 'top-secret' },
        body: {},
        query: {},
        rawBody: '',
      }),
    ).not.toThrow();
  });

  it('verifyWebhook aceita header como array', () => {
    const p = makeProvider(undefined, 'top-secret');
    expect(() =>
      p.verifyWebhook({
        headers: { 'x-webhook-secret': ['top-secret'] },
        body: {},
        query: {},
        rawBody: '',
      }),
    ).not.toThrow();
  });

  it('verifyWebhook lança quando header ausente', () => {
    const p = makeProvider(undefined, 'top-secret');
    expect(() =>
      p.verifyWebhook({ headers: {}, body: {}, query: {}, rawBody: '' }),
    ).toThrowError(WebhookSignatureError);
  });

  it('verifyWebhook lança quando header errado', () => {
    const p = makeProvider(undefined, 'top-secret');
    expect(() =>
      p.verifyWebhook({
        headers: { 'x-webhook-secret': 'wrong' },
        body: {},
        query: {},
        rawBody: '',
      }),
    ).toThrowError(WebhookSignatureError);
  });

  it('sendMessage delega ao client', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ id: 'wpp-123' }),
    } as unknown as Response) as unknown as typeof fetch;

    const p = makeProvider(fetchImpl);
    const r = await p.sendMessage('5547', { type: 'text', text: 'oi' });
    expect(r.providerMessageId).toBe('wpp-123');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
