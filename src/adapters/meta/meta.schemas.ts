import { z } from 'zod';

/**
 * Schemas Zod para validar webhooks da Meta Cloud API.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

const metaContactSchema = z.object({
  profile: z.object({ name: z.string().optional() }).optional(),
  wa_id: z.string(),
});

const metaTextSchema = z.object({ body: z.string() });

const metaMediaSchema = z.object({
  id: z.string(),
  mime_type: z.string().optional(),
  sha256: z.string().optional(),
  caption: z.string().optional(),
  filename: z.string().optional(),
});

const metaLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});

const metaReactionSchema = z.object({
  message_id: z.string(),
  emoji: z.string(),
});

const metaContextSchema = z.object({
  from: z.string().optional(),
  id: z.string().optional(),
});

const metaMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.string(),
  context: metaContextSchema.optional(),
  text: metaTextSchema.optional(),
  image: metaMediaSchema.optional(),
  audio: metaMediaSchema.optional(),
  video: metaMediaSchema.optional(),
  document: metaMediaSchema.optional(),
  sticker: metaMediaSchema.optional(),
  location: metaLocationSchema.optional(),
  reaction: metaReactionSchema.optional(),
});

const metaStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.string(),
  recipient_id: z.string(),
  errors: z
    .array(z.object({ code: z.number(), title: z.string() }))
    .optional(),
});

const metaValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(metaContactSchema).optional(),
  messages: z.array(metaMessageSchema).optional(),
  statuses: z.array(metaStatusSchema).optional(),
});

const metaChangeSchema = z.object({
  field: z.string(),
  value: metaValueSchema,
});

const metaEntrySchema = z.object({
  id: z.string(),
  changes: z.array(metaChangeSchema),
});

export const metaWebhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(metaEntrySchema),
});

export type MetaWebhookPayload = z.infer<typeof metaWebhookSchema>;
export type MetaMessage = z.infer<typeof metaMessageSchema>;
export type MetaStatus = z.infer<typeof metaStatusSchema>;
export type MetaContact = z.infer<typeof metaContactSchema>;
