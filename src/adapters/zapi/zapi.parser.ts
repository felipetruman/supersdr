import type {
  NormalizedEvent,
  NormalizedMessage,
  NormalizedStatusUpdate,
  NormalizedContact,
  MessageType,
  MessageStatus,
  MediaContent,
} from '../../core/types/message.js';
import type {
  ZapiReceivedCallback,
  ZapiStatusCallback,
  ZapiWebhookPayload,
} from './zapi.schemas.js';

/**
 * Parser de payloads Z-API → NormalizedEvent[].
 *
 * Sem I/O, sem side effects. Recebe payload já validado pelo Zod.
 * Z-API envia 1 evento por webhook (mantemos array por consistência com SDK).
 */
export function parseZapiPayload(
  payload: ZapiWebhookPayload,
): NormalizedEvent[] {
  if (payload.type === 'ReceivedCallback') {
    return [parseReceivedCallback(payload)];
  }
  return [parseStatusCallback(payload)];
}

// ---------------------------------------------------------------------------
// ReceivedCallback → NormalizedMessage
// ---------------------------------------------------------------------------

function parseReceivedCallback(p: ZapiReceivedCallback): NormalizedEvent {
  const { type, text } = inferMessageType(p);

  // Em grupo: phone = JID do grupo, participantPhone = quem realmente mandou
  const senderPhone = p.isGroup
    ? stripJidSuffix(p.participantPhone ?? '')
    : stripJidSuffix(p.phone);

  const chatPhone = stripJidSuffix(p.phone);

  const from: NormalizedContact = p.fromMe
    ? { phone: '', isGroup: false }
    : {
        phone: senderPhone,
        name: p.senderName ?? p.chatName,
        profilePictureUrl: p.senderPhoto ?? undefined,
        isGroup: false,
      };

  const to: NormalizedContact = {
    phone: chatPhone,
    isGroup: p.isGroup ?? false,
    profilePictureUrl: p.photo ?? undefined,
  };

  const message: NormalizedMessage = {
    provider: 'zapi',
    providerMessageId: p.messageId,
    providerInstanceId: p.instanceId,
    direction: p.fromMe ? 'outbound' : 'inbound',
    type,
    from,
    to,
    text,
    media: extractMedia(p),
    location: p.location
      ? {
          latitude: p.location.latitude,
          longitude: p.location.longitude,
          address: p.location.address,
        }
      : undefined,
    reaction:
      p.reaction && p.reaction.referencedMessage?.messageId
        ? {
            emoji: p.reaction.value,
            targetMessageId: p.reaction.referencedMessage.messageId,
          }
        : undefined,
    replyToMessageId: p.referenceMessageId,
    timestamp: new Date(p.momment),
    raw: p,
  };

  return { kind: 'message', data: message };
}

// ---------------------------------------------------------------------------
// MessageStatusCallback → NormalizedStatusUpdate
// ---------------------------------------------------------------------------

function parseStatusCallback(p: ZapiStatusCallback): NormalizedEvent {
  const update: NormalizedStatusUpdate = {
    provider: 'zapi',
    providerInstanceId: p.instanceId,
    providerMessageId: p.id ?? p.ids?.[0] ?? '',
    status: mapStatus(p.status),
    timestamp: new Date(p.momment),
    raw: p,
  };

  return { kind: 'status', data: update };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Z-API não tem campo "messageType" — discriminamos pela chave preenchida.
 */
function inferMessageType(p: ZapiReceivedCallback): {
  type: MessageType;
  text?: string;
} {
  if (p.text) return { type: 'text', text: p.text.message };
  if (p.image) return { type: 'image', text: p.image.caption };
  if (p.audio) return { type: 'audio' };
  if (p.video) return { type: 'video', text: p.video.caption };
  if (p.document) return { type: 'document', text: p.document.caption };
  if (p.sticker) return { type: 'sticker' };
  if (p.location) return { type: 'location' };
  if (p.contact) return { type: 'contact' };
  if (p.reaction) return { type: 'reaction' };
  return { type: 'unsupported' };
}

function extractMedia(p: ZapiReceivedCallback): MediaContent | undefined {
  if (p.image) {
    return {
      url: p.image.imageUrl,
      mimeType: p.image.mimeType,
      caption: p.image.caption,
    };
  }
  if (p.audio) {
    return {
      url: p.audio.audioUrl,
      mimeType: p.audio.mimeType,
    };
  }
  if (p.video) {
    return {
      url: p.video.videoUrl,
      mimeType: p.video.mimeType,
      caption: p.video.caption,
    };
  }
  if (p.document) {
    return {
      url: p.document.documentUrl,
      mimeType: p.document.mimeType,
      fileName: p.document.fileName,
      caption: p.document.caption,
    };
  }
  if (p.sticker) {
    return {
      url: p.sticker.stickerUrl,
      mimeType: p.sticker.mimeType,
    };
  }
  return undefined;
}

/**
 * Z-API → vocabulário normalizado.
 * PLAYED não existe no core (que tem só pending/sent/delivered/read/failed),
 * então mapeamos PLAYED → 'read' (áudio tocado implica lido).
 */
function mapStatus(s: ZapiStatusCallback['status']): MessageStatus {
  switch (s) {
    case 'PENDING':
      return 'pending';
    case 'SENT':
      return 'sent';
    case 'RECEIVED':
      return 'delivered';
    case 'READ':
    case 'READ_BY_ME':
    case 'PLAYED':
      return 'read';
  }
}

/**
 * Remove sufixo JID (@s.whatsapp.net, @c.us, @g.us) — Z-API alterna entre
 * número puro e JID dependendo do evento. Normalizamos para E.164 sem '+'.
 */
function stripJidSuffix(phone: string): string {
  const at = phone.indexOf('@');
  return at === -1 ? phone : phone.slice(0, at);
}
