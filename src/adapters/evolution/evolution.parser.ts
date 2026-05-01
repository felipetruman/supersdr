import type {
  MediaContent,
  MessageStatus,
  MessageType,
  NormalizedEvent,
  NormalizedMessage,
  NormalizedStatusUpdate,
} from '../../core/types/message.js';
import type {
  EvoMessageUpdate,
  EvoMessageUpsert,
  EvoWebhookPayload,
} from './evolution.schemas.js';

/**
 * Extrai o número do JID. Ex: "5547988887777@s.whatsapp.net" → "5547988887777"
 * Para grupos: "123456-789@g.us" → "123456-789" (mantém como id de grupo)
 */
function jidToPhone(jid: string): string {
  return jid.split('@')[0] ?? jid;
}

function isGroup(jid: string): boolean {
  return jid.endsWith('@g.us');
}

function toDate(ts: number | string): Date {
  const n = typeof ts === 'string' ? Number(ts) : ts;
  return new Date(n * 1000);
}

function detectType(upsert: EvoMessageUpsert['data']): MessageType {
  const m = upsert.message;
  if (!m) return 'unsupported';
  if (m.conversation || m.extendedTextMessage) return 'text';
  if (m.imageMessage) return 'image';
  if (m.audioMessage) return 'audio';
  if (m.videoMessage) return 'video';
  if (m.documentMessage) return 'document';
  if (m.stickerMessage) return 'sticker';
  if (m.locationMessage) return 'location';
  if (m.reactionMessage) return 'reaction';
  return 'unsupported';
}

function extractText(upsert: EvoMessageUpsert['data']): string | undefined {
  const m = upsert.message;
  if (!m) return undefined;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption
  );
}

function extractMedia(
  upsert: EvoMessageUpsert['data'],
): MediaContent | undefined {
  const m = upsert.message;
  if (!m) return undefined;
  const media =
    m.imageMessage ??
    m.audioMessage ??
    m.videoMessage ??
    m.documentMessage ??
    m.stickerMessage;
  if (!media) return undefined;
  return {
    url: media.url,
    mimeType: media.mimetype,
    caption: media.caption,
    fileName: media.fileName,
  };
}

function extractReplyTo(
  upsert: EvoMessageUpsert['data'],
): string | undefined {
  return upsert.message?.extendedTextMessage?.contextInfo?.stanzaId;
}

function buildMessage(payload: EvoMessageUpsert): NormalizedMessage {
  const { data, instance } = payload;
  const fromJid = data.key.remoteJid;
  const fromMe = data.key.fromMe;

  const type = detectType(data);

  return {
    providerMessageId: data.key.id,
    provider: 'evolution',
    providerInstanceId: instance,
    direction: fromMe ? 'outbound' : 'inbound',
    type,
    from: {
      phone: fromMe ? '' : jidToPhone(fromJid),
      name: data.pushName,
      isGroup: isGroup(fromJid) && !fromMe,
    },
    to: {
      phone: fromMe ? jidToPhone(fromJid) : '',
    },
    text: extractText(data),
    media: extractMedia(data),
    location: data.message?.locationMessage
      ? {
          latitude: data.message.locationMessage.degreesLatitude,
          longitude: data.message.locationMessage.degreesLongitude,
          name: data.message.locationMessage.name,
          address: data.message.locationMessage.address,
        }
      : undefined,
    reaction: data.message?.reactionMessage
      ? {
          emoji: data.message.reactionMessage.text,
          targetMessageId: data.message.reactionMessage.key.id,
        }
      : undefined,
    replyToMessageId: extractReplyTo(data),
    timestamp: toDate(data.messageTimestamp),
    raw: payload,
  };
}

/**
 * Mapeia status da Evolution (Baileys-style) para o domínio.
 */
function mapStatus(s: string): MessageStatus | null {
  switch (s.toUpperCase()) {
    case 'PENDING':
      return 'sent';
    case 'SERVER_ACK':
      return 'sent';
    case 'DELIVERY_ACK':
      return 'delivered';
    case 'READ':
    case 'PLAYED':
      return 'read';
    case 'ERROR':
      return 'failed';
    default:
      return null;
  }
}

function buildStatus(
  payload: EvoMessageUpdate,
): NormalizedStatusUpdate | null {
  const status = mapStatus(payload.data.status);
  if (!status) return null;

  const messageId = payload.data.keyId ?? payload.data.messageId;
  if (!messageId) return null;

  return {
    providerMessageId: messageId,
    provider: 'evolution',
    providerInstanceId: payload.instance,
    status,
    timestamp: new Date(),
    raw: payload,
  };
}

export function parseEvolutionPayload(
  payload: EvoWebhookPayload,
): NormalizedEvent[] {
  switch (payload.event) {
    case 'messages.upsert': {
      // Ignora mensagens enviadas pelo próprio bot (eco) — opcional, configurável
      return [{ kind: 'message', data: buildMessage(payload) }];
    }
    case 'messages.update': {
      const status = buildStatus(payload);
      return status ? [{ kind: 'status', data: status }] : [];
    }
  }
}
