import { describe, it, expect } from 'vitest';
import { parseMetaPayload } from '../../../adapters/meta/meta.parser.js';
import type { MetaWebhookPayload } from '../../../adapters/meta/meta.schemas.js';

const buildPayload = (msg: Record<string, unknown>): MetaWebhookPayload =>
  ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '551199999',
                phone_number_id: 'pnid',
              },
              messages: [msg],
            },
          },
        ],
      },
    ],
  }) as unknown as MetaWebhookPayload;

describe('meta.parser — gaps finais', () => {
  it('mapeia type=contacts → contact', () => {
    const events = parseMetaPayload(
      buildPayload({
        from: '5547',
        id: 'wamid.C',
        timestamp: '1700000000',
        type: 'contacts',
        contacts: [{ name: { formatted_name: 'Felipe' } }],
      }),
    );
    expect(events).toHaveLength(1);
    if (events[0].kind === 'message') {
      expect(events[0].data.type).toBe('contact');
    }
  });

  it('tipo desconhecido cai no default → unsupported', () => {
    const events = parseMetaPayload(
      buildPayload({
        from: '5547',
        id: 'wamid.U',
        timestamp: '1700000000',
        type: 'order', // tipo válido na Meta mas não mapeado
      }),
    );
    if (events[0].kind === 'message') {
      expect(events[0].data.type).toBe('unsupported');
    }
  });

  it('reaction message extrai emoji e targetMessageId', () => {
    const events = parseMetaPayload(
      buildPayload({
        from: '5547',
        id: 'wamid.R',
        timestamp: '1700000000',
        type: 'reaction',
        reaction: { emoji: '❤️', message_id: 'wamid.ORIG' },
      }),
    );
    if (events[0].kind === 'message') {
      expect(events[0].data.reaction).toEqual({
        emoji: '❤️',
        targetMessageId: 'wamid.ORIG',
      });
    }
  });

  it('mensagem com context.id preenche replyToMessageId', () => {
    const events = parseMetaPayload(
      buildPayload({
        from: '5547',
        id: 'wamid.RPL',
        timestamp: '1700000000',
        type: 'text',
        text: { body: 'reply' },
        context: { id: 'wamid.ORIG', from: '5548' },
      }),
    );
    if (events[0].kind === 'message') {
      expect(events[0].data.replyToMessageId).toBe('wamid.ORIG');
    }
  });

  it('media sticker é detectada via extractMedia', () => {
    const events = parseMetaPayload(
      buildPayload({
        from: '5547',
        id: 'wamid.S',
        timestamp: '1700000000',
        type: 'sticker',
        sticker: { id: 'sticker-1', mime_type: 'image/webp' },
      }),
    );
    if (events[0].kind === 'message') {
      expect(events[0].data.type).toBe('sticker');
      expect(events[0].data.media?.providerMediaId).toBe('sticker-1');
    }
  });

  it('audio sem caption usa undefined como text', () => {
    const events = parseMetaPayload(
      buildPayload({
        from: '5547',
        id: 'wamid.A',
        timestamp: '1700000000',
        type: 'audio',
        audio: { id: 'a1', mime_type: 'audio/ogg' },
      }),
    );
    if (events[0].kind === 'message') {
      expect(events[0].data.text).toBeUndefined();
      expect(events[0].data.media?.providerMediaId).toBe('a1');
    }
  });

  it('status com errors preenche errorReason', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '551199999',
                  phone_number_id: 'pnid',
                },
                statuses: [
                  {
                    id: 'wamid.S',
                    status: 'failed',
                    timestamp: '1700000000',
                    recipient_id: '5547',
                    errors: [{ code: 131_026, title: 'Message undeliverable' }],
                  },
                ],
              },
            },
          ],
        },
      ],
    } as unknown as MetaWebhookPayload;

    const events = parseMetaPayload(payload);
    if (events[0].kind === 'status') {
      expect(events[0].data.status).toBe('failed');
      expect(events[0].data.errorReason).toBe('Message undeliverable');
    }
  });

  it('payload sem messages nem statuses retorna []', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '551199999',
                  phone_number_id: 'pnid',
                },
              },
            },
          ],
        },
      ],
    } as unknown as MetaWebhookPayload;

    expect(parseMetaPayload(payload)).toEqual([]);
  });
});
