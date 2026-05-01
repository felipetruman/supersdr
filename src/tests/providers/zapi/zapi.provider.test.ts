import { describe, it, expect } from 'vitest';
import { ZapiProvider } from '../../../adapters/zapi/zapi.provider.js';
import {
  WebhookSignatureError,
  WebhookValidationError,
} from '../../../core/errors/provider-error.js';
import type { WebhookRequest } from '../../../core/providers/provider.interface.js';

function makeProvider(webhookClientToken?: string) {
  return new ZapiProvider({
    baseUrl: 'https://api.z-api.io',
    instanceId: 'INST123',
    instanceToken: 'TOKEN456',
    clientToken: 'CLIENT_TOKEN_789',
    webhookClientToken,
  });
}

function req(body: unknown, headers: Record<string, string> = {}): WebhookRequest {
  return {
    headers,
    rawBody: JSON.stringify(body),
    body,
    query: {},
  };
}

describe('ZapiProvider — verifyWebhook', () => {
  it('passa quando webhookClientToken não está configurado', () => {
    const provider = makeProvider();
    expect(() => provider.verifyWebhook(req({}, {}))).not.toThrow();
  });

  it('passa quando Client-Token bate (case lowercase)', () => {
    const provider = makeProvider('SECRET');
    expect(() =>
      provider.verifyWebhook(req({}, { 'client-token': 'SECRET' })),
    ).not.toThrow();
  });

  it('passa quando Client-Token bate (case original)', () => {
    const provider = makeProvider('SECRET');
    expect(() =>
      provider.verifyWebhook(req({}, { 'Client-Token': 'SECRET' })),
    ).not.toThrow();
  });

  it('lança WebhookSignatureError quando token não bate', () => {
    const provider = makeProvider('SECRET');
    expect(() =>
      provider.verifyWebhook(req({}, { 'client-token': 'WRONG' })),
    ).toThrow(WebhookSignatureError);
  });

  it('lança WebhookSignatureError quando header está ausente', () => {
    const provider = makeProvider('SECRET');
    expect(() => provider.verifyWebhook(req({}, {}))).toThrow(
      WebhookSignatureError,
    );
  });
});

describe('ZapiProvider — parseWebhook', () => {
  it('parseia ReceivedCallback de texto', () => {
    const provider = makeProvider();
    const events = provider.parseWebhook(
      req({
        type: 'ReceivedCallback',
        instanceId: 'zapi-inst-1',
        messageId: 'M1',
        phone: '5547988887777',
        fromMe: false,
        momment: 1700000000000,
        isGroup: false,
        senderName: 'Felipe',
        text: { message: 'oi' },
      }),
    );

    expect(events).toHaveLength(1);
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.text).toBe('oi');
  });

  it('parseia MessageStatusCallback', () => {
    const provider = makeProvider();
    const events = provider.parseWebhook(
      req({
        type: 'MessageStatusCallback',
        instanceId: 'zapi-inst-1',
        momment: 1700000000000,
        status: 'READ',
        id: 'M1',
        phone: '5547988887777',
      }),
    );

    expect(events).toHaveLength(1);
    if (events[0].kind !== 'status') throw new Error();
    expect(events[0].data.status).toBe('read');
  });

  it.each([
    'ConnectedCallback',
    'DisconnectedCallback',
    'PresenceChatCallback',
    'NotificationCallback',
    'ChatPresenceCallback',
  ])('retorna [] para evento conhecido mas não suportado: %s', (type) => {
    const provider = makeProvider();
    const events = provider.parseWebhook(req({ type, instanceId: 'x' }));
    expect(events).toEqual([]);
  });

  it('lança WebhookValidationError para payload sem type', () => {
    const provider = makeProvider();
    expect(() => provider.parseWebhook(req({ foo: 'bar' }))).toThrow(
      WebhookValidationError,
    );
  });

  it('lança WebhookValidationError para type desconhecido', () => {
    const provider = makeProvider();
    expect(() =>
      provider.parseWebhook(req({ type: 'TotalmenteInventadoCallback' })),
    ).toThrow(WebhookValidationError);
  });

  it('lança WebhookValidationError para body null', () => {
    const provider = makeProvider();
    expect(() => provider.parseWebhook(req(null))).toThrow(
      WebhookValidationError,
    );
  });
});

describe('ZapiProvider — name', () => {
  it('expõe name=zapi', () => {
    expect(makeProvider().name).toBe('zapi');
  });
});
