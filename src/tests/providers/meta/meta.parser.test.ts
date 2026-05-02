import { describe, expect, it } from 'vitest';
import { parseMetaPayload } from '../../../adapters/meta/meta.parser.js';
import { metaWebhookSchema } from '../../../adapters/meta/meta.schemas.js';

function buildPayload(overrides: Partial<{ messages: unknown[]; statuses: unknown[]; contacts: unknown[] }> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5547999999999',
                phone_number_id: 'PNID_123',
              },
              contacts: overrides.contacts ?? [
                { profile: { name: 'Felipe' }, wa_id: '5547988887777' },
              ],
              messages: overrides.messages ?? [],
              statuses: overrides.statuses ?? [],
            },
          },
        ],
      },
    ],
  };
}

describe('parseMetaPayload', () => {
  it('parseia mensagem de texto', () => {
    const raw = buildPayload({
      messages: [
        {
          id: 'wamid.ABC',
          from: '5547988887777',
          timestamp: '1700000000',
          type: 'text',
          text: { body: 'oi' },
        },
      ],
    });
    const payload = metaWebhookSchema.parse(raw);
    const events = parseMetaPayload(payload);

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('message');
    if (events[0].kind !== 'message') throw new Error('expected message');
    expect(events[0].data).toMatchObject({
      provider: 'meta',
      providerMessageId: 'wamid.ABC',
      providerInstanceId: 'PNID_123',
      direction: 'inbound',
      type: 'text',
      text: 'oi',
      from: { phone: '5547988887777', name: 'Felipe' },
      to: { phone: '5547999999999' },
    });
  });

  it('parseia mensagem com reply (context)', () => {
    const raw = buildPayload({
      messages: [
        {
          id: 'wamid.REPLY',
          from: '5547988887777',
          timestamp: '1700000000',
          type: 'text',
          text: { body: 'respondendo' },
          context: { id: 'wamid.ORIGINAL', from: '5547999999999' },
        },
      ],
    });
    const events = parseMetaPayload(metaWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error('expected message');
    expect(events[0].data.replyToMessageId).toBe('wamid.ORIGINAL');
  });

  it('parseia imagem com caption', () => {
    const raw = buildPayload({
      messages: [
        {
          id: 'wamid.IMG',
          from: '5547988887777',
          timestamp: '1700000000',
          type: 'image',
          image: {
            id: 'MEDIA_ID',
            mime_type: 'image/jpeg',
            caption: 'olha isso',
          },
        },
      ],
    });
    const events = parseMetaPayload(metaWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error('expected message');
    expect(events[0].data.type).toBe('image');
    expect(events[0].data.media?.providerMediaId).toBe('MEDIA_ID');
    expect(events[0].data.media?.mimeType).toBe('image/jpeg');
    expect(events[0].data.text).toBe('olha isso');
  });

  it('parseia status update', () => {
    const raw = buildPayload({
      statuses: [
        {
          id: 'wamid.SENT',
          status: 'delivered',
          timestamp: '1700000100',
          recipient_id: '5547988887777',
        },
      ],
      messages: [],
    });
    const events = parseMetaPayload(metaWebhookSchema.parse(raw));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('status');
    if (events[0].kind !== 'status') throw new Error('expected status');
    expect(events[0].data.status).toBe('delivered');
    expect(events[0].data.providerMessageId).toBe('wamid.SENT');
  });

  it('parseia múltiplos eventos no mesmo webhook', () => {
    const raw = buildPayload({
      messages: [
        {
          id: 'wamid.M1',
          from: '5547988887777',
          timestamp: '1700000000',
          type: 'text',
          text: { body: 'um' },
        },
      ],
      statuses: [
        {
          id: 'wamid.S1',
          status: 'read',
          timestamp: '1700000050',
          recipient_id: '5547988887777',
        },
      ],
    });
    const events = parseMetaPayload(metaWebhookSchema.parse(raw));
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.kind)).toEqual(['message', 'status']);
  });

  it('marca tipo desconhecido como unsupported', () => {
    const raw = buildPayload({
      messages: [
        {
          id: 'wamid.X',
          from: '5547988887777',
          timestamp: '1700000000',
          type: 'order',
        },
      ],
    });
    const events = parseMetaPayload(metaWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error('expected message');
    expect(events[0].data.type).toBe('unsupported');
  });
});
