import { z } from 'zod';

/**
 * Schemas Zod para webhooks da Evolution Go API.
 * Docs: https://docs.evolutionfoundation.com.br/en/evolution-go
 *
 * Como o Evolution Go usa whatsmeow (mesma stack Multi-Device do Baileys),
 * o formato dos webhooks é praticamente idêntico ao evolution-baileys.
 *
 * Eventos relevantes:
 * - messages.upsert       → mensagem nova (inbound ou outbound recém-enviada)
 * - messages.update       → mudança de status (sent/delivered/read)
 */

// ---------- messages.upsert ----------

const evoGoKeySchema = z.object({
  remoteJid: z.string(),
  fromMe: z.boolean(),
  id: z.string(),
  participant: z.string().optional(),
});

const evoGoMediaMessageSchema = z.object({
  url: z.string().optional(),
  mimetype: z.string().optional(),
  caption: z.string().optional(),
  fileName: z.string().optional(),
  mediaKey: z.string().optional(),
  fileSha256: z.string().optional(),
});

const evoGoLocationMessageSchema = z.object({
  degreesLatitude: z.number(),
  degreesLongitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});

const evoGoExtendedTextSchema = z.object({
  text: z.string(),
  contextInfo: z
    .object({
      stanzaId: z.string().optional(),
      participant: z.string().optional(),
    })
    .optional(),
});

const evoGoMessageContentSchema = z.object({
  conversation: z.string().optional(),
  extendedTextMessage: evoGoExtendedTextSchema.optional(),
  imageMessage: evoGoMediaMessageSchema.optional(),
  audioMessage: evoGoMediaMessageSchema.optional(),
  videoMessage: evoGoMediaMessageSchema.optional(),
  documentMessage: evoGoMediaMessageSchema.optional(),
  stickerMessage: evoGoMediaMessageSchema.optional(),
  locationMessage: evoGoLocationMessageSchema.optional(),
  reactionMessage: z
    .object({
      key: evoGoKeySchema.partial({ fromMe: true }),
      text: z.string(),
    })
    .optional(),
});

const evoGoUpsertDataSchema = z.object({
  key: evoGoKeySchema,
  pushName: z.string().optional(),
  message: evoGoMessageContentSchema.optional(),
  messageType: z.string().optional(),
  messageTimestamp: z.union([z.number(), z.string()]),
});

export const evoGoMessageUpsertSchema = z.object({
  event: z.literal('messages.upsert'),
  instance: z.string(),
  data: evoGoUpsertDataSchema,
  destination: z.string().optional(),
  date_time: z.string().optional(),
  sender: z.string().optional(),
  server_url: z.string().optional(),
  apikey: z.string().optional(),
});

// ---------- messages.update (status) ----------

export const evoGoMessageUpdateSchema = z.object({
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

// ---------- união ----------

export const evoGoWebhookSchema = z.discriminatedUnion('event', [
  evoGoMessageUpsertSchema,
  evoGoMessageUpdateSchema,
]);

export type EvoGoWebhookPayload = z.infer<typeof evoGoWebhookSchema>;
export type EvoGoMessageUpsert = z.infer<typeof evoGoMessageUpsertSchema>;
export type EvoGoMessageUpdate = z.infer<typeof evoGoMessageUpdateSchema>;
