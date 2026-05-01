/**
 * Fixtures de payloads do WPPConnect.
 * Refs: https://wppconnect-team.github.io/docs/
 */

export const SESSION = 'NERDWHATS_AMERICA';

export function onMessageText(overrides: Record<string, unknown> = {}) {
  return {
    event: 'onmessage',
    session: SESSION,
    id: 'true_5547988887777@c.us_MSG1',
    body: 'oi tudo bem?',
    type: 'chat',
    from: '5547988887777@c.us',
    to: '5547999990000@c.us',
    fromMe: false,
    isGroupMsg: false,
    notifyName: 'Felipe',
    sender: { pushname: 'Felipe', name: 'Felipe Dev' },
    timestamp: 1700000000,
    ...overrides,
  };
}

export function onMessageImage(overrides: Record<string, unknown> = {}) {
  return {
    event: 'onmessage',
    session: SESSION,
    id: 'true_5547988887777@c.us_IMG1',
    type: 'image',
    from: '5547988887777@c.us',
    fromMe: false,
    caption: 'olha isso',
    mimetype: 'image/jpeg',
    mediaUrl: 'https://cdn.example.com/img.jpg',
    filename: 'img.jpg',
    timestamp: 1700000001,
    ...overrides,
  };
}

export function onMessageAudio(overrides: Record<string, unknown> = {}) {
  return {
    event: 'onmessage',
    session: SESSION,
    id: 'true_5547988887777@c.us_PTT1',
    type: 'ptt',
    from: '5547988887777@c.us',
    fromMe: false,
    mimetype: 'audio/ogg; codecs=opus',
    mediaUrl: 'https://cdn.example.com/ptt.ogg',
    timestamp: 1700000002,
    ...overrides,
  };
}

export function onMessageLocation(overrides: Record<string, unknown> = {}) {
  return {
    event: 'onmessage',
    session: SESSION,
    id: 'true_5547988887777@c.us_LOC1',
    type: 'location',
    from: '5547988887777@c.us',
    fromMe: false,
    lat: '-26.9194',
    lng: '-49.0661',
    loc: 'Blumenau',
    timestamp: 1700000003,
    ...overrides,
  };
}

export function onMessageGroup(overrides: Record<string, unknown> = {}) {
  return {
    event: 'onmessage',
    session: SESSION,
    id: 'false_120363000000000000@g.us_GRP1',
    body: 'mensagem no grupo',
    type: 'chat',
    from: '120363000000000000@g.us',
    author: '5547988887777@c.us',
    fromMe: false,
    isGroupMsg: true,
    notifyName: 'Felipe',
    sender: { pushname: 'Felipe' },
    timestamp: 1700000004,
    ...overrides,
  };
}

export function onMessageQuoted(overrides: Record<string, unknown> = {}) {
  return {
    event: 'onmessage',
    session: SESSION,
    id: 'true_5547988887777@c.us_REPLY1',
    body: 'respondendo',
    type: 'chat',
    from: '5547988887777@c.us',
    fromMe: false,
    quotedMsgId: 'true_5547988887777@c.us_ORIGINAL',
    timestamp: 1700000005,
    ...overrides,
  };
}

export function onAck(ackCode: number, overrides: Record<string, unknown> = {}) {
  return {
    event: 'onack',
    session: SESSION,
    id: {
      _serialized: 'true_5547988887777@c.us_ACKMSG',
      id: 'ACKMSG',
      fromMe: true,
    },
    ack: ackCode,
    to: '5547988887777@c.us',
    from: '5547999990000@c.us',
    ...overrides,
  };
}
