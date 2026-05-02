import { describe, expect, it } from 'vitest';
import { EvolutionProvider } from '../../../adapters/evolution-baileys/evolution-baileys.provider.js';
import { WebhookSignatureError } from '../../../core/errors/provider-error.js';

function makeProvider(webhookApiKey?: string) {
  return new EvolutionProvider({
    baseUrl: 'http://fake',
    instance: 'comercial-01',
    apiKey: 'send-key',
    webhookApiKey,
  });
}

describe('EvolutionProvider.verifyWebhook', () => {
  it('passa quando webhookApiKey não configurado', () => {
    const p = makeProvider();
    expect(() =>
      p.verifyWebhook({ rawBody: '', body: {}, headers: {}, query: {} }),
    ).not.toThrow();
  });

  it('passa quando apikey bate', () => {
    const p = makeProvider('secret-123');
    expect(() =>
      p.verifyWebhook({
        rawBody: '',
        body: {},
        headers: { apikey: 'secret-123' },
        query: {},
      }),
    ).not.toThrow();
  });

  it('lança quando apikey não bate', () => {
    const p = makeProvider('secret-123');
    expect(() =>
      p.verifyWebhook({
        rawBody: '',
        body: {},
        headers: { apikey: 'wrong' },
        query: {},
      }),
    ).toThrow(WebhookSignatureError);
  });
});

describe('EvolutionProvider.parseWebhook', () => {
  it('retorna [] para connection.update (evento não suportado)', () => {
    const p = makeProvider();
    const events = p.parseWebhook({
      rawBody: '',
      body: { event: 'connection.update', instance: 'x', data: {} },
      headers: {},
      query: {},
    });
    expect(events).toEqual([]);
  });

  it('parseia messages.upsert válido', () => {
    const p = makeProvider();
    const events = p.parseWebhook({
      rawBody: '',
      body: {
        event: 'messages.upsert',
        instance: 'comercial-01',
        data: {
          key: { remoteJid: '5547988887777@s.whatsapp.net', fromMe: false, id: 'X' },
          message: { conversation: 'oi' },
          messageTimestamp: 1700000000,
        },
      },
      headers: {},
      query: {},
    });
    expect(events).toHaveLength(1);
  });
});
