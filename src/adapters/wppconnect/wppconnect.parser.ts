import type {
  MediaContent,
  MessageStatus,
  MessageType,
  NormalizedContact,
  NormalizedEvent,
  NormalizedMessage,
  NormalizedStatusUpdate,
} from '../../core/types/message.js';
import {
  wppOnAckSchema,
  wppOnMessageSchema,
  type WppOnAck,
  type WppOnMessage,
} from './wppconnect.schemas.js';

/** Remove sufixos @c.us / @g.us / @s.whatsapp.net e retorna só o número */
function jidToPhone(jid: string): string {
  return jid.split('@')[0]?.replace(/[^0-9]/g, '') ?? '';
}

function isGroupJid(jid: string | undefined): boolean {
  return !!jid && jid.endsWith('@g.us');
}

/** Mapeia 'type' do WPPConnect → MessageType normalizado */
function mapWppType(type: string, hasLocation: boolean): MessageType {
  if (hasLocation) return 'location';
  switch (type) {
    case 'chat':
      return 'text';
    case 'image':
      return 'image';
    case 'audio':
    case 'ptt':
      return 'audio';
    case 'video':
      return 'video';
    case 'document':
      return 'document';
    case 'sticker':
      return 'sticker';
    case 'location':
      return 'location';
    case 'vcard':
    case 'multi_vcard':
      return 'contact';
    default:
      return 'unsupported';
  }
}

/**
 * WhatsApp ack codes:
 *  -1 error | 0 pending | 1 sent | 2 delivered | 3 read | 4 played
 */
function mapAck(ack: number): MessageStatus | null {
  if (ack === -1) return 'failed';
  if (ack === 0) return 'pending';
  if (ack === 1) return 'sent';
  if (ack === 2) return 'delivered';
  if (ack >= 3) return 'read';
  return null;
}

function buildContact(jid: string, name?: string): NormalizedContact {
  return {
    phone: jidToPhone(jid),
    name,
    isGroup: isGroupJid(jid),
  };
}

function parseLocation(msg: WppOnMessage) {
  const lat = typeof msg.lat === 'string' ? Number(msg.lat) : msg.lat;
  const lng = typeof msg.lng === 'string' ? Number(msg.lng) : msg.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined;
  return { latitude: lat, longitude: lng, name: msg.loc };
}

function parseMedia(msg: WppOnMessage): MediaContent | undefined {
  if (!msg.mediaUrl && !msg.mimetype) return undefined;
  return {
    url: msg.mediaUrl,
    mimeType: msg.mimetype,
    fileName: msg.filename,
    caption: msg.caption,
  };
}

function parseOnMessage(msg: WppOnMessage, sessionId: string): NormalizedMessage {
  const fromMe = msg.fromMe ?? false;
  const isGroup = msg.isGroupMsg ?? isGroupJid(msg.from);

  // Em grupo, o remetente real é msg.author; msg.from é o JID do grupo
  const senderJid = isGroup && msg.author ? msg.author : msg.from;
  const senderName = msg.sender?.pushname ?? msg.sender?.name ?? msg.notifyName;

  const direction = fromMe ? 'outbound' : 'inbound';
  const peerJid = msg.to ?? msg.from;

  const fromContact = buildContact(senderJid, fromMe ? undefined : senderName);
  const toContact = buildContact(peerJid);

  if (isGroup) {
    if (direction === 'inbound') fromContact.isGroup = true;
    else toContact.isGroup = true;
  }

  const location = parseLocation(msg);
  const type = mapWppType(String(msg.type), !!location);
  const text = msg.body ?? msg.caption;

  const tsSeconds = msg.timestamp ?? msg.t;
  const timestamp = tsSeconds ? new Date(tsSeconds * 1000) : new Date();

  return {
    provider: 'wppconnect',
    providerMessageId: msg.id,
    providerInstanceId: sessionId,
    direction,
    type,
    text,
    media: parseMedia(msg),
    location,
    replyToMessageId: msg.quotedMsgId ?? undefined,
    from: fromContact,
    to: toContact,
    timestamp,
    raw: msg,
  };
}

function parseOnAck(ack: WppOnAck, sessionId: string): NormalizedStatusUpdate | null {
  const status = mapAck(ack.ack);
  if (!status) return null;

  let messageId: string | undefined;
  if (typeof ack.id === 'string') {
    messageId = ack.id;
  } else if (ack.id && typeof ack.id === 'object') {
    messageId = ack.id._serialized ?? ack.id.id;
  }
  if (!messageId) return null;

  return {
    provider: 'wppconnect',
    providerMessageId: messageId,
    providerInstanceId: sessionId,
    status,
    timestamp: new Date(),
    raw: ack,
  };
}

/**
 * Parser principal — recebe payload bruto e retorna eventos normalizados.
 * O sessionId padrão vem do config; payload.session sobrescreve se presente.
 */
export function parseWppPayload(
  payload: { event: string } & Record<string, unknown>,
  defaultSessionId: string,
): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const sessionId =
    typeof payload.session === 'string' && payload.session.length > 0
      ? payload.session
      : defaultSessionId;

  switch (payload.event) {
    case 'onmessage': {
      const parsed = wppOnMessageSchema.safeParse(payload);
      if (!parsed.success) return events;
      events.push({ kind: 'message', data: parseOnMessage(parsed.data, sessionId) });
      return events;
    }

    case 'onack': {
      const parsed = wppOnAckSchema.safeParse(payload);
      if (!parsed.success) return events;
      const status = parseOnAck(parsed.data, sessionId);
      if (status) events.push({ kind: 'status', data: status });
      return events;
    }

    // Eventos conhecidos mas ignorados
    case 'onpresencechanged':
    case 'onparticipantschanged':
    case 'onreactionmessage':
    case 'onpollresponse':
    case 'onrevokedmessage':
    case 'onlabelupdated':
    case 'incomingcall':
    case 'status-find':
    case 'qrcode':
    case 'unreadmessages':
      return events;

    default:
      return events;
  }
}
