import { describe, expect, it } from 'vitest';
import { parseWppPayload } from '../../../adapters/wppconnect/wppconnect.parser.js';
import {
  SESSION,
  onAck,
  onMessageAudio,
  onMessageGroup,
  onMessageImage,
  onMessageLocation,
  onMessageQuoted,
  onMessageText,
} from './__fixtures__/wppconnect.fixtures.js';

describe('parseWppPayload — onmessage', () => {
  it('parseia texto simples (chat)', () => {
    const events = parseWppPayload(onMessageText() as never, SESSION);

    expect(events).toHaveLength(1);
    if (events[0].kind !== 'message') throw new Error('expected message');
    expect(events[0].data).toMatchObject({
      provider: 'wppconnect',
      providerMessageId: 'true_5547988887777@c.us_MSG1',
      providerInstanceId: SESSION,
      direction: 'inbound',
      type: 'text',
      text: 'oi tudo bem?',
      from: { phone: '5547988887777', name: 'Felipe', isGroup: false },
    });
  });

  it('parseia imagem com caption e mediaUrl', () => {
    const events = parseWppPayload(onMessageImage() as never, SESSION);
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('image');
    expect(events[0].data.text).toBe('olha isso');
    expect(events[0].data.media).toMatchObject({
      url: 'https://cdn.example.com/img.jpg',
      mimeType: 'image/jpeg',
      fileName: 'img.jpg',
      caption: 'olha isso',
    });
  });

  it('mapeia ptt → audio', () => {
    const events = parseWppPayload(onMessageAudio() as never, SESSION);
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('audio');
    expect(events[0].data.media?.mimeType).toContain('audio/ogg');
  });

  it('parseia location convertendo lat/lng string→number', () => {
    const events = parseWppPayload(onMessageLocation() as never, SESSION);
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('location');
    expect(events[0].data.location).toMatchObject({
      latitude: -26.9194,
      longitude: -49.0661,
      name: 'Blumenau',
    });
  });

  it('em grupo, usa author como remetente real e marca isGroup', () => {
    const events = parseWppPayload(onMessageGroup() as never, SESSION);
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.from.phone).toBe('5547988887777');
    expect(events[0].data.to.phone).toBe('120363000000000000');
    expect(events[0].data.to.isGroup).toBe(true);
  });

  it('marca outbound quando fromMe=true', () => {
    const events = parseWppPayload(
      onMessageText({ fromMe: true }) as never,
      SESSION,
    );
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.direction).toBe('outbound');
  });

  it('extrai replyToMessageId de quotedMsgId', () => {
    const events = parseWppPayload(onMessageQuoted() as never, SESSION);
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.replyToMessageId).toBe(
      'true_5547988887777@c.us_ORIGINAL',
    );
  });

  it('usa session do payload quando presente, senão default', () => {
    const evWithSession = parseWppPayload(
      onMessageText({ session: 'OUTRA' }) as never,
      'DEFAULT',
    );
    const evWithoutSession = parseWppPayload(
      onMessageText({ session: undefined }) as never,
      'DEFAULT',
    );
    if (evWithSession[0].kind !== 'message') throw new Error();
    if (evWithoutSession[0].kind !== 'message') throw new Error();
    expect(evWithSession[0].data.providerInstanceId).toBe('OUTRA');
    expect(evWithoutSession[0].data.providerInstanceId).toBe('DEFAULT');
  });

  it('tipo desconhecido cai em unsupported (fallback)', () => {
    const events = parseWppPayload(
      onMessageText({ type: 'tipo_novo_xyz', body: 'x' }) as never,
      SESSION,
    );
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('unsupported');
  });
});

describe('parseWppPayload — onack', () => {
  it.each([
    [-1, 'failed'],
    [0, 'pending'],
    [1, 'sent'],
    [2, 'delivered'],
    [3, 'read'],
    [4, 'read'],
  ] as const)('mapeia ack=%i → %s', (code, expected) => {
    const events = parseWppPayload(onAck(code) as never, SESSION);
    expect(events).toHaveLength(1);
    if (events[0].kind !== 'status') throw new Error('expected status');
    expect(events[0].data.status).toBe(expected);
    expect(events[0].data.providerMessageId).toBe(
      'true_5547988887777@c.us_ACKMSG',
    );
  });

  it('aceita ack.id como string pura', () => {
    const events = parseWppPayload(
      onAck(2, { id: 'STRING_ID' }) as never,
      SESSION,
    );
    if (events[0].kind !== 'status') throw new Error();
    expect(events[0].data.providerMessageId).toBe('STRING_ID');
  });
});

describe('parseWppPayload — eventos ignorados', () => {
  it.each([
    'onpresencechanged',
    'onreactionmessage',
    'onrevokedmessage',
    'qrcode',
    'incomingcall',
  ])('retorna [] para %s', (event) => {
    const events = parseWppPayload({ event } as never, SESSION);
    expect(events).toEqual([]);
  });

  it('retorna [] para evento desconhecido', () => {
    const events = parseWppPayload(
      { event: 'evento_inexistente_xyz' } as never,
      SESSION,
    );
    expect(events).toEqual([]);
  });
});
