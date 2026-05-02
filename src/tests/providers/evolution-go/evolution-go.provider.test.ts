import { describe, expect, it } from 'vitest';
import { EvolutionGoProvider } from '../../../adapters/evolution-go/evolution-go.provider.js';
import { WebhookSignatureError } from '../../../core/errors/provider-error.js';

function makeProvider(webhookApiKey?: string) {
  return new EvolutionGoProvider({
    baseUrl: 'http://fake:4000',
    instance: 'comercial-01',
    apiKey: 'send-key',
    webhookApiKey,
  });
}

describe('EvolutionGoProvider.verifyWebhook', () => {
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

  it('aceita apikey como array (header repetido)', () => {
    const p = makeProvider('secret-123');
    expect(() =>
      p.verifyWebhook({
        rawBody: '',
        body: {},
        headers: { apikey: ['secret-123'] },
        query: {},
      }),
    ).not.toThrow();
  });
});

describe('EvolutionGoProvider.parseWebhook', () => {
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

  it('retorna [] para qrcode.updated', () => {
    const p = makeProvider();
    const events = p.parseWebhook({
      rawBody: '',
      body: { event: 'qrcode.updated', instance: 'x', data: {} },
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
          message: { conversation: 'oi do go' },
          messageTimestamp: 1700000000,
        },
      },
      headers: {},
      query: {},
    });
    expect(events).toHaveLength(1);
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.provider).toBe('evolution-go');
    expect(events[0].data.text).toBe('oi do go');
  });

  it('lança WebhookValidationError pra payload inválido desconhecido', () => {
    const p = makeProvider();
    expect(() =>
      p.parseWebhook({
        rawBody: '',
        body: { event: 'evento.inexistente', foo: 'bar' },
        headers: {},
        query: {},
      }),
    ).toThrow();
  });
});
