import { describe, expect, it } from 'vitest';
import { parseZapiPayload } from '../../../adapters/zapi/zapi.parser.js';
import { zapiWebhookSchema } from '../../../adapters/zapi/zapi.schemas.js';

/**
 * Helper: monta um ReceivedCallback mínimo da Z-API.
 * Doc: https://developer.z-api.io/webhooks/received-callback
 */
function received(
  content: Record<string, unknown>,
  opts: Partial<{
    fromMe: boolean;
    isGroup: boolean;
    senderName: string;
    messageId: string;
    phone: string;
    participantPhone: string;
    referenceMessageId: string;
  }> = {},
) {
  return {
    type: 'ReceivedCallback' as const,
    instanceId: 'zapi-inst-1',
    messageId: opts.messageId ?? 'ZAPI_MSG_1',
    phone: opts.phone ?? '5547988887777',
    fromMe: opts.fromMe ?? false,
    momment: 1700000000000,
    isGroup: opts.isGroup ?? false,
    senderName: opts.senderName ?? 'Felipe',
    participantPhone: opts.participantPhone,
    referenceMessageId: opts.referenceMessageId,
    ...content,
  };
}

describe('parseZapiPayload — ReceivedCallback', () => {
  it('parseia mensagem de texto simples', () => {
    const raw = received({ text: { message: 'oi tudo bem?' } });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));

    expect(events).toHaveLength(1);
    if (events[0].kind !== 'message') throw new Error('esperava message');

    expect(events[0].data).toMatchObject({
      provider: 'zapi',
      providerMessageId: 'ZAPI_MSG_1',
      providerInstanceId: 'zapi-inst-1',
      direction: 'inbound',
      type: 'text',
      text: 'oi tudo bem?',
      from: { phone: '5547988887777', name: 'Felipe' },
      to: { phone: '5547988887777', isGroup: false },
    });
  });

  it('marca direction=outbound quando fromMe=true', () => {
    const raw = received({ text: { message: 'eu mandei' } }, { fromMe: true });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.direction).toBe('outbound');
  });

  it('parseia imagem com caption e mimeType', () => {
    const raw = received({
      image: {
        imageUrl: 'https://cdn.zapi/img.jpg',
        mimeType: 'image/jpeg',
        caption: 'olha isso',
      },
    });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();

    expect(events[0].data.type).toBe('image');
    expect(events[0].data.text).toBe('olha isso');
    expect(events[0].data.media).toEqual({
      url: 'https://cdn.zapi/img.jpg',
      mimeType: 'image/jpeg',
      caption: 'olha isso',
    });
  });

  it('parseia áudio (sem caption)', () => {
    const raw = received({
      audio: {
        audioUrl: 'https://cdn.zapi/audio.ogg',
        mimeType: 'audio/ogg',
      },
    });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('audio');
    expect(events[0].data.media?.url).toBe('https://cdn.zapi/audio.ogg');
    expect(events[0].data.text).toBeUndefined();
  });

  it('parseia vídeo com caption', () => {
    const raw = received({
      video: {
        videoUrl: 'https://cdn.zapi/v.mp4',
        mimeType: 'video/mp4',
        caption: 'assista',
      },
    });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('video');
    expect(events[0].data.text).toBe('assista');
  });

  it('parseia documento com fileName', () => {
    const raw = received({
      document: {
        documentUrl: 'https://cdn.zapi/file.pdf',
        mimeType: 'application/pdf',
        fileName: 'contrato.pdf',
        caption: 'segue em anexo',
      },
    });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('document');
    expect(events[0].data.media?.fileName).toBe('contrato.pdf');
    expect(events[0].data.text).toBe('segue em anexo');
  });

  it('parseia sticker', () => {
    const raw = received({
      sticker: {
        stickerUrl: 'https://cdn.zapi/s.webp',
        mimeType: 'image/webp',
      },
    });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('sticker');
  });

  it('parseia location', () => {
    const raw = received({
      location: {
        latitude: -26.9,
        longitude: -49.07,
        address: 'Blumenau, SC',
      },
    });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('location');
    expect(events[0].data.location).toEqual({
      latitude: -26.9,
      longitude: -49.07,
      address: 'Blumenau, SC',
    });
  });

  it('parseia reaction com targetMessageId', () => {
    const raw = received({
      reaction: {
        value: '👍',
        referencedMessage: { messageId: 'ORIGINAL_ID' },
      },
    });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('reaction');
    expect(events[0].data.reaction).toEqual({
      emoji: '👍',
      targetMessageId: 'ORIGINAL_ID',
    });
  });

  it('preserva replyToMessageId quando há referenceMessageId', () => {
    const raw = received(
      { text: { message: 'respondendo' } },
      { referenceMessageId: 'PARENT_MSG_ID' },
    );
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.replyToMessageId).toBe('PARENT_MSG_ID');
  });

  it('em grupo, from.phone usa participantPhone (sem JID)', () => {
    const raw = received(
      { text: { message: 'msg em grupo' } },
      {
        isGroup: true,
        phone: '120363025@g.us',
        participantPhone: '5547988887777@c.us',
        senderName: 'Felipe',
      },
    );
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();

    expect(events[0].data.from.phone).toBe('5547988887777');
    expect(events[0].data.to).toMatchObject({
      phone: '120363025',
      isGroup: true,
    });
  });

  it('remove sufixo @s.whatsapp.net / @c.us de phones em DM', () => {
    const raw = received(
      { text: { message: 'oi' } },
      { phone: '5547988887777@c.us' },
    );
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.from.phone).toBe('5547988887777');
    expect(events[0].data.to.phone).toBe('5547988887777');
  });

  it('converte momment (epoch ms) em Date', () => {
    const raw = received({ text: { message: 'hi' } });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.timestamp).toBeInstanceOf(Date);
    expect(events[0].data.timestamp.getTime()).toBe(1700000000000);
  });

  it('preserva payload original em raw', () => {
    const raw = received({ text: { message: 'oi' } });
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    const parsed = zapiWebhookSchema.parse(raw);
    const ev = parseZapiPayload(parsed);
    if (ev[0].kind !== "message") throw new Error();
    expect(ev[0].data.raw).toBe(parsed);
  });
});

describe('parseZapiPayload — MessageStatusCallback', () => {
  function status(
    s: 'PENDING' | 'SENT' | 'RECEIVED' | 'READ' | 'READ_BY_ME' | 'PLAYED',
    opts: Partial<{ id: string; ids: string[] }> = {},
  ) {
    return {
      type: 'MessageStatusCallback' as const,
      instanceId: 'zapi-inst-1',
      momment: 1700000000000,
      status: s,
      id: opts.id ?? 'ZAPI_MSG_1',
      ids: opts.ids,
      phone: '5547988887777',
    };
  }

  it.each([
    ['PENDING', 'pending'],
    ['SENT', 'sent'],
    ['RECEIVED', 'delivered'],
    ['READ', 'read'],
    ['READ_BY_ME', 'read'],
    ['PLAYED', 'read'],
  ] as const)('mapeia %s → %s', (zapiStatus, normalized) => {
    const raw = status(zapiStatus);
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'status') throw new Error('esperava status');
    expect(events[0].data.status).toBe(normalized);
    expect(events[0].data.providerMessageId).toBe('ZAPI_MSG_1');
    expect(events[0].data.provider).toBe('zapi');
  });

  it('usa ids[0] quando id não estiver presente', () => {
    const raw = {
      type: 'MessageStatusCallback' as const,
      instanceId: 'zapi-inst-1',
      momment: 1700000000000,
      status: 'SENT' as const,
      ids: ['ID_FROM_ARRAY'],
      phone: '5547988887777',
    };
    const events = parseZapiPayload(zapiWebhookSchema.parse(raw));
    if (events[0].kind !== 'status') throw new Error();
    expect(events[0].data.providerMessageId).toBe('ID_FROM_ARRAY');
  });
});
