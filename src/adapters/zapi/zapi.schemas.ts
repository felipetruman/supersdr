import { z } from 'zod';

/**
 * Schemas Zod para validação de payloads da Z-API.
 * Doc oficial: https://developer.z-api.io/webhooks/on-message-received
 *
 * A Z-API envia DOIS tipos de webhook distintos:
 *  - ReceivedCallback     → mensagem recebida (com "type" do conteúdo aninhado)
 *  - MessageStatusCallback → atualização de status (SENT/RECEIVED/READ/PLAYED)
 */

// ---------------------------------------------------------------------------
// Sub-schemas de conteúdo (cada tipo de mensagem tem seu objeto)
// ---------------------------------------------------------------------------

export const zapiTextContentSchema = z.object({
  message: z.string(),
});

export const zapiImageContentSchema = z.object({
  caption: z.string().optional(),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  mimeType: z.string().optional(),
});

export const zapiAudioContentSchema = z.object({
  audioUrl: z.string().url(),
  mimeType: z.string().optional(),
  // Z-API marca PTT (push-to-talk / voz) com este campo
  ptt: z.boolean().optional(),
});

export const zapiVideoContentSchema = z.object({
  caption: z.string().optional(),
  videoUrl: z.string().url(),
  mimeType: z.string().optional(),
});

export const zapiDocumentContentSchema = z.object({
  caption: z.string().optional(),
  documentUrl: z.string().url(),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  pageCount: z.number().optional(),
});

export const zapiStickerContentSchema = z.object({
  stickerUrl: z.string().url(),
  mimeType: z.string().optional(),
});

export const zapiLocationContentSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional(),
  url: z.string().url().optional(),
});

export const zapiContactContentSchema = z.object({
  displayName: z.string().optional(),
  vCard: z.string().optional(),
});

export const zapiReactionContentSchema = z.object({
  value: z.string(),
  time: z.number().optional(),
  referencedMessage: z
    .object({
      messageId: z.string(),
      fromMe: z.boolean().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Webhook: mensagem recebida (ReceivedCallback)
// ---------------------------------------------------------------------------

export const zapiReceivedCallbackSchema = z.object({
  type: z.literal('ReceivedCallback'),
  instanceId: z.string(),
  messageId: z.string(),
  phone: z.string(),
  fromMe: z.boolean(),
  momment: z.number(),
  status: z.string().optional(),
  chatName: z.string().optional(),
  senderName: z.string().optional(),
  senderPhoto: z.string().url().optional().nullable(),
  participantPhone: z.string().optional().nullable(),
  photo: z.string().url().optional().nullable(),
  broadcast: z.boolean().optional(),
  isGroup: z.boolean().optional(),
  referenceMessageId: z.string().optional(),
  waitingMessage: z.boolean().optional(),

  // Conteúdo: pelo menos um deles vem preenchido conforme o tipo da msg
  text: zapiTextContentSchema.optional(),
  image: zapiImageContentSchema.optional(),
  audio: zapiAudioContentSchema.optional(),
  video: zapiVideoContentSchema.optional(),
  document: zapiDocumentContentSchema.optional(),
  sticker: zapiStickerContentSchema.optional(),
  location: zapiLocationContentSchema.optional(),
  contact: zapiContactContentSchema.optional(),
  reaction: zapiReactionContentSchema.optional(),
});

// ---------------------------------------------------------------------------
// Webhook: atualização de status (MessageStatusCallback)
// ---------------------------------------------------------------------------

export const zapiStatusCallbackSchema = z.object({
  type: z.literal('MessageStatusCallback'),
  instanceId: z.string(),
  status: z.enum(['PENDING', 'SENT', 'RECEIVED', 'READ', 'PLAYED', 'READ_BY_ME']),
  ids: z.array(z.string()).optional(),
  id: z.string().optional(),
  phone: z.string(),
  momment: z.number(),
});

// ---------------------------------------------------------------------------
// Union discriminada — qualquer webhook da Z-API cai aqui
// ---------------------------------------------------------------------------

export const zapiWebhookSchema = z.discriminatedUnion('type', [
  zapiReceivedCallbackSchema,
  zapiStatusCallbackSchema,
]);

// ---------------------------------------------------------------------------
// Tipos inferidos
// ---------------------------------------------------------------------------

export type ZapiReceivedCallback = z.infer<typeof zapiReceivedCallbackSchema>;
export type ZapiStatusCallback = z.infer<typeof zapiStatusCallbackSchema>;
export type ZapiWebhookPayload = z.infer<typeof zapiWebhookSchema>;
