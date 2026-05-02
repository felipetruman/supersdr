import { z } from 'zod';

/**
 * Schemas Zod para webhooks da Evolution API.
 * Docs: https://doc.evolution-api.com/v2/api-reference/webhook
 *
 * Eventos relevantes:
 * - messages.upsert       → mensagem nova (inbound ou outbound recém-enviada)
 * - messages.update       → mudança de status (sent/delivered/read)
 * - send.message          → confirmação de envio (alguns deploys)
 */

// ---------- messages.upsert ----------

const evoKeySchema = z.object({
  remoteJid: z.string(),       // ex: 5547988887777@s.whatsapp.net
  fromMe: z.boolean(),
  id: z.string(),
  participant: z.string().optional(), // em grupos
});

const evoMediaMessageSchema = z.object({
  url: z.string().optional(),
  mimetype: z.string().optional(),
  caption: z.string().optional(),
  fileName: z.string().optional(),
  mediaKey: z.string().optional(),
  fileSha256: z.string().optional(),
});

const evoLocationMessageSchema = z.object({
  degreesLatitude: z.number(),
  degreesLongitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});

const evoExtendedTextSchema = z.object({
  text: z.string(),
  contextInfo: z
    .object({
      stanzaId: z.string().optional(),
      participant: z.string().optional(),
    })
    .optional(),
});

const evoMessageContentSchema = z.object({
  conversation: z.string().optional(),
  extendedTextMessage: evoExtendedTextSchema.optional(),
  imageMessage: evoMediaMessageSchema.optional(),
  audioMessage: evoMediaMessageSchema.optional(),
  videoMessage: evoMediaMessageSchema.optional(),
  documentMessage: evoMediaMessageSchema.optional(),
  stickerMessage: evoMediaMessageSchema.optional(),
  locationMessage: evoLocationMessageSchema.optional(),
  reactionMessage: z
    .object({
      key: evoKeySchema.partial({ fromMe: true }),
      text: z.string(),
    })
    .optional(),
});

const evoUpsertDataSchema = z.object({
  key: evoKeySchema,
  pushName: z.string().optional(),
  message: evoMessageContentSchema.optional(),
  messageType: z.string().optional(),
  messageTimestamp: z.union([z.number(), z.string()]),
});

export const evoMessageUpsertSchema = z.object({
  event: z.literal('messages.upsert'),
  instance: z.string(),
  data: evoUpsertDataSchema,
  destination: z.string().optional(),
  date_time: z.string().optional(),
  sender: z.string().optional(),
  server_url: z.string().optional(),
  apikey: z.string().optional(),
});

// ---------- messages.update (status) ----------

export const evoMessageUpdateSchema = z.object({
  event: z.literal('messages.update'),
  instance: z.string(),
  data: z.object({
    keyId: z.string().optional(),
    messageId: z.string().optional(),
    remoteJid: z.string().optional(),
    fromMe: z.boolean().optional(),
    status: z.string(), // PENDING | SERVER_ACK | DELIVERY_ACK | READ | PLAYED | ERROR
  }),
});

// ---------- união de todos os webhooks suportados ----------

export const evoWebhookSchema = z.discriminatedUnion('event', [
  evoMessageUpsertSchema,
  evoMessageUpdateSchema,
]);

export type EvoWebhookPayload = z.infer<typeof evoWebhookSchema>;
export type EvoMessageUpsert = z.infer<typeof evoMessageUpsertSchema>;
export type EvoMessageUpdate = z.infer<typeof evoMessageUpdateSchema>;
