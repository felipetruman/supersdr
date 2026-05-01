import { describe, it, expect } from 'vitest';
import { parseWppPayload } from '../../../adapters/wppconnect/wppconnect.parser.js';

const baseMsg = (over: Record<string, unknown> = {}) => ({
  event: 'onmessage',
  session: 'sess-1',
  id: 'mid',
  from: '5547@c.us',
  to: '5548@c.us',
  type: 'chat',
  body: 'oi',
  timestamp: 1700000000,
  ...over,
});

describe('wppconnect.parser — gaps', () => {
  it.each([
    ['ptt', 'audio'],
    ['audio', 'audio'],
    ['sticker', 'sticker'],
    ['vcard', 'contact'],
    ['multi_vcard', 'contact'],
    ['document', 'document'],
    ['video', 'video'],
    ['unknown_type', 'unsupported'],
  ])('mapeia type=%s → %s', (wppType, expected) => {
    const ev = parseWppPayload(baseMsg({ type: wppType }) as never, 'sess-default');
    if (ev[0]?.kind === 'message') expect(ev[0].data.type).toBe(expected);
  });

  it.each([
    [-1, 'failed'],
    [0, 'pending'],
    [1, 'sent'],
    [2, 'delivered'],
    [3, 'read'],
    [4, 'read'],
  ])('mapeia ack=%i → %s', (ack, expected) => {
    const ev = parseWppPayload(
      { event: 'onack', session: 's', id: 'mid', ack } as never,
      'sess',
    );
    if (ev[0]?.kind === 'status') expect(ev[0].data.status).toBe(expected);
  });

  it('ack inválido (-2) retorna vazio', () => {
    const ev = parseWppPayload(
      { event: 'onack', session: 's', id: 'mid', ack: -2 } as never,
      'sess',
    );
    expect(ev).toEqual([]);
  });

  it('ack.id como objeto com _serialized', () => {
    const ev = parseWppPayload(
      {
        event: 'onack',
        session: 's',
        id: { _serialized: 'true_5547@c.us_ABC', id: 'ABC' },
        ack: 2,
      } as never,
      'sess',
    );
    if (ev[0]?.kind === 'status') {
      expect(ev[0].data.providerMessageId).toBe('true_5547@c.us_ABC');
    }
  });

  it('ack.id objeto sem _serialized usa .id', () => {
    const ev = parseWppPayload(
      {
        event: 'onack',
        session: 's',
        id: { id: 'ABC' },
        ack: 2,
      } as never,
      'sess',
    );
    if (ev[0]?.kind === 'status') {
      expect(ev[0].data.providerMessageId).toBe('ABC');
    }
  });

  it('location com lat/lng como string', () => {
    const ev = parseWppPayload(
      baseMsg({
        type: 'location',
        lat: '-26.9',
        lng: '-49.0',
        loc: 'Blumenau',
      }) as never,
      'sess',
    );
    if (ev[0]?.kind === 'message') {
      expect(ev[0].data.type).toBe('location');
      expect(ev[0].data.location).toEqual({
        latitude: -26.9,
        longitude: -49.0,
        name: 'Blumenau',
      });
    }
  });

  it('location com lat NaN → ignora coordenadas', () => {
    const ev = parseWppPayload(
      baseMsg({ type: 'location', lat: 'abc', lng: '-49' }) as never,
      'sess',
    );
    if (ev[0]?.kind === 'message') {
      expect(ev[0].data.location).toBeUndefined();
    }
  });

  it('mensagem em grupo usa author como sender e marca isGroup', () => {
    const ev = parseWppPayload(
      baseMsg({
        from: '12345-67@g.us',
        author: '5547@c.us',
        isGroupMsg: true,
        sender: { pushname: 'Felipe' },
      }) as never,
      'sess',
    );
    if (ev[0]?.kind === 'message') {
      expect(ev[0].data.from.phone).toBe('5547');
      expect(ev[0].data.from.isGroup).toBe(true);
    }
  });

  it('mensagem outbound em grupo marca to.isGroup', () => {
    const ev = parseWppPayload(
      baseMsg({
        from: '12345-67@g.us',
        fromMe: true,
        isGroupMsg: true,
      }) as never,
      'sess',
    );
    if (ev[0]?.kind === 'message') {
      expect(ev[0].data.direction).toBe('outbound');
      expect(ev[0].data.to.isGroup).toBe(true);
    }
  });

  it('usa defaultSessionId quando session ausente', () => {
    const ev = parseWppPayload(
      { ...baseMsg(), session: undefined } as never,
      'default-sess',
    );
    if (ev[0]?.kind === 'message') {
      expect(ev[0].data.providerInstanceId).toBe('default-sess');
    }
  });

  it('sem timestamp, usa Date.now()', () => {
    const ev = parseWppPayload(
      baseMsg({ timestamp: undefined, t: undefined }) as never,
      'sess',
    );
    if (ev[0]?.kind === 'message') {
      expect(ev[0].data.timestamp).toBeInstanceOf(Date);
    }
  });

  it('onmessage com payload inválido retorna []', () => {
    const ev = parseWppPayload(
      { event: 'onmessage', session: 's' } as never,
      'sess',
    );
    expect(ev).toEqual([]);
  });

  it('onack com payload inválido retorna []', () => {
    const ev = parseWppPayload(
      { event: 'onack', session: 's' } as never,
      'sess',
    );
    expect(ev).toEqual([]);
  });

  it.each([
    'onpresencechanged',
    'onparticipantschanged',
    'onreactionmessage',
    'onpollresponse',
    'onrevokedmessage',
    'onlabelupdated',
    'incomingcall',
    'status-find',
    'qrcode',
    'unreadmessages',
    'totally-unknown-event',
  ])('evento %s ignorado retorna []', (event) => {
    const ev = parseWppPayload({ event, session: 's' } as never, 'sess');
    expect(ev).toEqual([]);
  });
});
