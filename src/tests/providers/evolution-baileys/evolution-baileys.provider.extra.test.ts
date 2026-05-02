import { describe, it, expect, vi } from 'vitest';
import { EvolutionProvider } from '../../../adapters/evolution-baileys/evolution-baileys.provider.js';
import {
  WebhookSignatureError,
  WebhookValidationError,
} from '../../../core/errors/provider-error.js';

function makeProvider(opts: {
  fetchImpl?: typeof fetch;
  webhookApiKey?: string;
} = {}) {
  return new EvolutionProvider({
    baseUrl: 'http://evo.test',
    instance: 'inst-1',
    apiKey: 'k',
    fetchImpl: opts.fetchImpl,
    webhookApiKey: opts.webhookApiKey,
  });
}

describe('EvolutionProvider — gaps', () => {
  it('verifyWebhook bypass sem webhookApiKey configurada', () => {
    const p = makeProvider();
    expect(() =>
      p.verifyWebhook({ headers: {}, body: {}, query: {}, rawBody: '' }),
    ).not.toThrow();
  });

  it('verifyWebhook aceita apikey correta', () => {
    const p = makeProvider({ webhookApiKey: 'secret' });
    expect(() =>
      p.verifyWebhook({
        headers: { apikey: 'secret' },
        body: {},
        query: {},
        rawBody: '',
      }),
    ).not.toThrow();
  });

  it('verifyWebhook aceita apikey como array', () => {
    const p = makeProvider({ webhookApiKey: 'secret' });
    expect(() =>
      p.verifyWebhook({
        headers: { apikey: ['secret'] },
        body: {},
        query: {},
        rawBody: '',
      }),
    ).not.toThrow();
  });

  it('verifyWebhook lança quando apikey errada', () => {
    const p = makeProvider({ webhookApiKey: 'secret' });
    expect(() =>
      p.verifyWebhook({
        headers: { apikey: 'wrong' },
        body: {},
        query: {},
        rawBody: '',
      }),
    ).toThrowError(WebhookSignatureError);
  });

  it.each([
    'connection.update',
    'qrcode.updated',
    'presence.update',
    'contacts.update',
    'chats.update',
  ])('parseWebhook ignora evento %s retornando []', (event) => {
    const p = makeProvider();
    const events = p.parseWebhook({
      headers: {},
      body: { event },
      query: {},
      rawBody: '',
    });
    expect(events).toEqual([]);
  });

  it('parseWebhook lança WebhookValidationError em payload realmente inválido', () => {
    const p = makeProvider();
    expect(() =>
      p.parseWebhook({
        headers: {},
        body: { event: 'unknown.event', random: true },
        query: {},
        rawBody: '',
      }),
    ).toThrowError(WebhookValidationError);
  });

  it('sendMessage delega ao client', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ key: { id: 'evo-X' } }),
    } as unknown as Response) as unknown as typeof fetch;

    const p = makeProvider({ fetchImpl });
    const r = await p.sendMessage('5547', { type: 'text', text: 'oi' });
    expect(r.providerMessageId).toBe('evo-X');
  });
});
