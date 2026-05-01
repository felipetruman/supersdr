/**
 * Mensagens de SAÍDA (outbound) — o que mandamos pro provider.
 */

export interface OutboundTextMessage {
  type: 'text';
  text: string;
  /** Responder uma mensagem específica */
  replyToMessageId?: string;
}

export interface OutboundMediaMessage {
  type: 'image' | 'audio' | 'video' | 'document';
  url: string;
  caption?: string;
  fileName?: string;
}

export interface OutboundLocationMessage {
  type: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export type OutboundMessage =
  | OutboundTextMessage
  | OutboundMediaMessage
  | OutboundLocationMessage;

export interface SendResult {
  /** ID retornado pelo provider */
  providerMessageId: string;
  /** Timestamp aceito pelo provider */
  acceptedAt: Date;
  raw: unknown;
}
