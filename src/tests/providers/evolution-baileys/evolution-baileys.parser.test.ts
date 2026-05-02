import { describe, expect, it } from 'vitest';
import { parseEvolutionPayload } from '../../../adapters/evolution-baileys/evolution-baileys.parser.js';
import { evoWebhookSchema } from '../../../adapters/evolution-baileys/evolution-baileys.schemas.js';

function upsert(messageContent: Record<string, unknown>, opts: Partial<{ fromMe: boolean; pushName: string; id: string }> = {}) {
  return {
    event: 'messages.upsert',
    instance: 'comercial-01',
    data: {
      key: {
        remoteJid: '5547988887777@s.whatsapp.net',
        fromMe: opts.fromMe ?? false,
        id: opts.id ?? 'EVO_MSG_1',
      },
      pushName: opts.pushName ?? 'Felipe',
      message: messageContent,
      messageTimestamp: 1700000000,
    },
  };
}

describe('parseEvolutionPayload', () => {
  it('parseia conversation (texto simples)', () => {
    const raw = upsert({ conversation: 'oi tudo bem?' });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));

    expect(events).toHaveLength(1);
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data).toMatchObject({
      provider: 'evolution-baileys',
      providerMessageId: 'EVO_MSG_1',
      providerInstanceId: 'comercial-01',
      direction: 'inbound',
      type: 'text',
      text: 'oi tudo bem?',
      from: { phone: '5547988887777', name: 'Felipe' },
    });
  });

  it('parseia extendedTextMessage com reply', () => {
    const raw = upsert({
      extendedTextMessage: {
        text: 'respondendo',
        contextInfo: { stanzaId: 'ORIGINAL_ID' },
      },
    });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.text).toBe('respondendo');
    expect(events[0].data.replyToMessageId).toBe('ORIGINAL_ID');
  });

  it('parseia imagem com caption', () => {
    const raw = upsert({
      imageMessage: {
        url: 'https://cdn/image.jpg',
        mimetype: 'image/jpeg',
        caption: 'olha isso',
      },
    });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('image');
    expect(events[0].data.media?.url).toBe('https://cdn/image.jpg');
    expect(events[0].data.text).toBe('olha isso');
  });

  it('marca outbound quando fromMe=true', () => {
    const raw = upsert({ conversation: 'eu enviei' }, { fromMe: true });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.direction).toBe('outbound');
    expect(events[0].data.to.phone).toBe('5547988887777');
  });

  it('parseia status DELIVERY_ACK como delivered', () => {
    const raw = {
      event: 'messages.update',
      instance: 'comercial-01',
      data: {
        keyId: 'EVO_MSG_1',
        remoteJid: '5547988887777@s.whatsapp.net',
        fromMe: true,
        status: 'DELIVERY_ACK',
      },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    expect(events).toHaveLength(1);
    if (events[0].kind !== 'status') throw new Error();
    expect(events[0].data.status).toBe('delivered');
    expect(events[0].data.providerMessageId).toBe('EVO_MSG_1');
  });

  it('mapeia READ → read', () => {
    const raw = {
      event: 'messages.update',
      instance: 'comercial-01',
      data: { keyId: 'X', status: 'READ' },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'status') throw new Error();
    expect(events[0].data.status).toBe('read');
  });

  it('mapeia ERROR → failed', () => {
    const raw = {
      event: 'messages.update',
      instance: 'comercial-01',
      data: { keyId: 'X', status: 'ERROR' },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'status') throw new Error();
    expect(events[0].data.status).toBe('failed');
  });

  it('ignora status desconhecido', () => {
    const raw = {
      event: 'messages.update',
      instance: 'comercial-01',
      data: { keyId: 'X', status: 'WEIRD_STATUS' },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    expect(events).toHaveLength(0);
  });

  it('parseia location', () => {
    const raw = upsert({
      locationMessage: {
        degreesLatitude: -26.9194,
        degreesLongitude: -49.0661,
        name: 'Blumenau',
      },
    });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('location');
    expect(events[0].data.location).toMatchObject({
      latitude: -26.9194,
      longitude: -49.0661,
      name: 'Blumenau',
    });
  });

  it('detecta grupo via @g.us', () => {
    const raw = {
      event: 'messages.upsert',
      instance: 'comercial-01',
      data: {
        key: {
          remoteJid: '120363xxx@g.us',
          fromMe: false,
          id: 'GRP_MSG',
          participant: '5547988887777@s.whatsapp.net',
        },
        pushName: 'Alguém',
        message: { conversation: 'oi grupo' },
        messageTimestamp: 1700000000,
      },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.from.isGroup).toBe(true);
  });
});
