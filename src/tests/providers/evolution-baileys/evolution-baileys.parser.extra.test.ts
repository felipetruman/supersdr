import { describe, it, expect } from 'vitest';
import { parseEvolutionPayload } from '../../../adapters/evolution-baileys/evolution-baileys.parser.js';

const baseUpsert = (message: Record<string, unknown>, extra = {}) => ({
  event: 'messages.upsert' as const,
  instance: 'inst-1',
  data: {
    key: { id: 'msg-1', remoteJid: '5547@s.whatsapp.net', fromMe: false },
    pushName: 'User',
    messageTimestamp: 1700000000,
    message,
    ...extra,
  },
});

describe('evolution.parser — gaps', () => {
  it('detecta sticker', () => {
    const ev = parseEvolutionPayload(
      baseUpsert({ stickerMessage: { url: 'u', mimetype: 'image/webp' } }) as never,
    );
    expect(ev[0]).toMatchObject({ kind: 'message' });
    if (ev[0].kind === 'message') expect(ev[0].data.type).toBe('sticker');
  });

  it('detecta reaction', () => {
    const ev = parseEvolutionPayload(
      baseUpsert({
        reactionMessage: { text: '👍', key: { id: 'orig' } },
      }) as never,
    );
    if (ev[0].kind === 'message') {
      expect(ev[0].data.type).toBe('reaction');
      expect(ev[0].data.reaction?.emoji).toBe('👍');
    }
  });

  it('mensagem sem campo message → unsupported', () => {
    const ev = parseEvolutionPayload({
      event: 'messages.upsert',
      instance: 'inst-1',
      data: {
        key: { id: 'm', remoteJid: '5547@s.whatsapp.net', fromMe: false },
        messageTimestamp: 1700000000,
      },
    } as never);
    if (ev[0].kind === 'message') expect(ev[0].data.type).toBe('unsupported');
  });

  it('fromMe inverte from/to e marca outbound', () => {
    const ev = parseEvolutionPayload(
      baseUpsert({ conversation: 'oi' }, {
        key: { id: 'm', remoteJid: '5547@s.whatsapp.net', fromMe: true },
      }) as never,
    );
    if (ev[0].kind === 'message') {
      expect(ev[0].data.direction).toBe('outbound');
      expect(ev[0].data.from.phone).toBe('');
      expect(ev[0].data.to.phone).toBe('5547');
    }
  });

  it('grupo: marca isGroup=true em inbound', () => {
    const ev = parseEvolutionPayload(
      baseUpsert({ conversation: 'oi' }, {
        key: { id: 'm', remoteJid: '12345-67@g.us', fromMe: false },
      }) as never,
    );
    if (ev[0].kind === 'message') {
      expect(ev[0].data.from.isGroup).toBe(true);
    }
  });

  it.each([
    ['PENDING', 'sent'],
    ['SERVER_ACK', 'sent'],
    ['DELIVERY_ACK', 'delivered'],
    ['READ', 'read'],
    ['PLAYED', 'read'],
    ['ERROR', 'failed'],
  ])('mapeia status %s → %s', (raw, expected) => {
    const ev = parseEvolutionPayload({
      event: 'messages.update',
      instance: 'inst-1',
      data: { keyId: 'mid', status: raw },
    } as never);
    expect(ev).toHaveLength(1);
    if (ev[0].kind === 'status') expect(ev[0].data.status).toBe(expected);
  });

  it('status desconhecido → vazio', () => {
    const ev = parseEvolutionPayload({
      event: 'messages.update',
      instance: 'inst-1',
      data: { keyId: 'mid', status: 'WHATEVER' },
    } as never);
    expect(ev).toEqual([]);
  });

  it('messages.update sem keyId nem messageId → vazio', () => {
    const ev = parseEvolutionPayload({
      event: 'messages.update',
      instance: 'inst-1',
      data: { status: 'READ' },
    } as never);
    expect(ev).toEqual([]);
  });

  it('messageTimestamp como string é convertido', () => {
    const ev = parseEvolutionPayload(
      baseUpsert({ conversation: 'oi' }, {
        messageTimestamp: '1700000000',
      }) as never,
    );
    if (ev[0].kind === 'message') {
      expect(ev[0].data.timestamp).toBeInstanceOf(Date);
    }
  });
});
