/**
 * Tipos normalizados — formato canônico independente do provider.
 * Todo adapter (Meta, Evolution, WPPConnect, Z-API) converte PARA esses tipos.
 */

export type ProviderName = 'meta' | 'evolution-baileys' | 'evolution-go' | 'wppconnect' | 'zapi';

export type MessageDirection = 'inbound' | 'outbound';

export type MessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'unsupported';

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface MediaContent {
  url?: string;
  mimeType?: string;
  caption?: string;
  fileName?: string;
  size?: number;
  /** ID interno do provider pra baixar a mídia depois */
  providerMediaId?: string;
}

export interface LocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ReactionContent {
  emoji: string;
  /** ID da mensagem reagida */
  targetMessageId: string;
}

export interface NormalizedContact {
  /** Telefone E.164 sem '+' (ex: 5547999999999) */
  phone: string;
  name?: string;
  profilePictureUrl?: string;
  /** True quando o contato é um grupo do WhatsApp (jid @g.us) */
  isGroup?: boolean;
}

export interface NormalizedMessage {
  /** ID único da mensagem no provider */
  providerMessageId: string;
  provider: ProviderName;
  /** Identificador da instância/conta no provider (phone_number_id, instanceName, etc) */
  providerInstanceId: string;

  direction: MessageDirection;
  type: MessageType;

  from: NormalizedContact;
  to: NormalizedContact;

  /** Conteúdo textual (text, caption, etc) */
  text?: string;
  media?: MediaContent;
  location?: LocationContent;
  reaction?: ReactionContent;

  /** Mensagem que está sendo respondida (reply) */
  replyToMessageId?: string;

  timestamp: Date;
  /** Payload original cru — útil pra debug e replay */
  raw: unknown;
}

export interface NormalizedStatusUpdate {
  providerMessageId: string;
  provider: ProviderName;
  providerInstanceId: string;
  status: MessageStatus;
  timestamp: Date;
  errorReason?: string;
  raw: unknown;
}

export type NormalizedEvent =
  | { kind: 'message'; data: NormalizedMessage }
  | { kind: 'status'; data: NormalizedStatusUpdate };
