import type {
  MediaContent,
  MessageType,
  NormalizedEvent,
  NormalizedMessage,
  NormalizedStatusUpdate,
  MessageStatus,
} from '../../core/types/message.js';
import type {
  MetaContact,
  MetaMessage,
  MetaStatus,
  MetaWebhookPayload,
} from './meta.schemas.js';

/**
 * Converte timestamp Unix (string em segundos) → Date.
 */
function toDate(unixSeconds: string): Date {
  return new Date(Number(unixSeconds) * 1000);
}

function mapMessageType(type: string): MessageType {
  switch (type) {
    case 'text':
    case 'image':
    case 'audio':
    case 'video':
    case 'document':
    case 'sticker':
    case 'location':
    case 'reaction':
      return type;
    case 'contacts':
      return 'contact';
    default:
      return 'unsupported';
  }
}

function extractMedia(msg: MetaMessage): MediaContent | undefined {
  const media =
    msg.image ?? msg.audio ?? msg.video ?? msg.document ?? msg.sticker;
  if (!media) return undefined;
  return {
    providerMediaId: media.id,
    mimeType: media.mime_type,
    caption: media.caption,
    fileName: media.filename,
  };
}

function buildMessage(
  msg: MetaMessage,
  contact: MetaContact | undefined,
  phoneNumberId: string,
  displayPhoneNumber: string,
): NormalizedMessage {
  const type = mapMessageType(msg.type);

  return {
    providerMessageId: msg.id,
    provider: 'meta',
    providerInstanceId: phoneNumberId,
    direction: 'inbound',
    type,
    from: {
      phone: msg.from,
      name: contact?.profile?.name,
    },
    to: {
      phone: displayPhoneNumber,
    },
    text: msg.text?.body ?? extractMedia(msg)?.caption,
    media: extractMedia(msg),
    location: msg.location
      ? {
          latitude: msg.location.latitude,
          longitude: msg.location.longitude,
          name: msg.location.name,
          address: msg.location.address,
        }
      : undefined,
    reaction: msg.reaction
      ? {
          emoji: msg.reaction.emoji,
          targetMessageId: msg.reaction.message_id,
        }
      : undefined,
    replyToMessageId: msg.context?.id,
    timestamp: toDate(msg.timestamp),
    raw: msg,
  };
}

function mapStatus(s: MetaStatus['status']): MessageStatus {
  return s; // Meta usa os mesmos nomes do nosso domínio
}

function buildStatus(
  status: MetaStatus,
  phoneNumberId: string,
): NormalizedStatusUpdate {
  return {
    providerMessageId: status.id,
    provider: 'meta',
    providerInstanceId: phoneNumberId,
    status: mapStatus(status.status),
    timestamp: toDate(status.timestamp),
    errorReason: status.errors?.[0]?.title,
    raw: status,
  };
}

/**
 * Converte payload validado da Meta em lista de eventos normalizados.
 * Um único webhook pode trazer N mensagens + N status.
 */
export function parseMetaPayload(
  payload: MetaWebhookPayload,
): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const { value } = change;
      const phoneNumberId = value.metadata.phone_number_id;
      const displayPhoneNumber = value.metadata.display_phone_number;

      // Index de contatos por wa_id pra associar com mensagens
      const contactsByWaId = new Map<string, MetaContact>();
      for (const c of value.contacts ?? []) {
        contactsByWaId.set(c.wa_id, c);
      }

      for (const msg of value.messages ?? []) {
        events.push({
          kind: 'message',
          data: buildMessage(
            msg,
            contactsByWaId.get(msg.from),
            phoneNumberId,
            displayPhoneNumber,
          ),
        });
      }

      for (const status of value.statuses ?? []) {
        events.push({
          kind: 'status',
          data: buildStatus(status, phoneNumberId),
        });
      }
    }
  }

  return events;
}
