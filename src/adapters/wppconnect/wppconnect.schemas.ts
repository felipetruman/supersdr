import { z } from 'zod';

/**
 * WPPConnect webhook payloads (event = 'onmessage' | 'onack' | ...)
 *
 * Diferente do Evolution, o WPPConnect entrega payloads "humanos":
 * campos já decodificados (body, from, to, type, isGroupMsg).
 *
 * Refs: https://wppconnect-team.github.io/docs/
 */

const wppMessageTypeEnum = z.enum([
  'chat',           // texto
  'image',
  'audio',
  'ptt',            // push-to-talk (áudio gravado)
  'video',
  'document',
  'sticker',
  'location',
  'vcard',
  'multi_vcard',
  'revoked',
]).or(z.string()); // fallback pra tipos novos

/** Evento onmessage */
export const wppOnMessageSchema = z.object({
  event: z.literal('onmessage'),
  session: z.string().optional(),
  id: z.string(),                          // message id (ex: "true_5547...@c.us_3EB0")
  body: z.string().optional(),
  caption: z.string().optional(),
  type: wppMessageTypeEnum,
  from: z.string(),                        // jid: "5547999999999@c.us" ou "...@g.us"
  to: z.string().optional(),
  fromMe: z.boolean().optional(),
  author: z.string().optional(),           // em grupo: jid do remetente real
  isGroupMsg: z.boolean().optional(),
  notifyName: z.string().optional(),
  sender: z
    .object({
      id: z.string().optional(),
      pushname: z.string().optional(),
      name: z.string().optional(),
      formattedName: z.string().optional(),
      profilePicThumbObj: z
        .object({ eurl: z.string().optional(), img: z.string().optional() })
        .partial()
        .optional(),
    })
    .partial()
    .optional(),
  timestamp: z.number().optional(),
  t: z.number().optional(),
  // mídia
  mimetype: z.string().optional(),
  mediaUrl: z.string().optional(),         // quando autoDownload + uploadS3
  filename: z.string().optional(),
  // localização
  lat: z.union([z.string(), z.number()]).optional(),
  lng: z.union([z.string(), z.number()]).optional(),
  loc: z.string().optional(),
  // reply
  quotedMsgId: z.string().nullable().optional(),
  quotedMsg: z.unknown().optional(),
}).passthrough();

/** Evento onack — confirmação de status */
export const wppOnAckSchema = z.object({
  event: z.literal('onack'),
  session: z.string().optional(),
  id: z
    .object({
      _serialized: z.string().optional(),
      id: z.string().optional(),
      remote: z.unknown().optional(),
      fromMe: z.boolean().optional(),
    })
    .partial()
    .or(z.string()),
  ack: z.number(),                         // -1 erro | 0 pending | 1 sent | 2 delivered | 3 read | 4 played
  to: z.string().optional(),
  from: z.string().optional(),
}).passthrough();

/** Wrapper genérico — aceita qualquer evento, validamos por discriminação no parser */
export const wppWebhookSchema = z
  .object({ event: z.string() })
  .passthrough();

export type WppOnMessage = z.infer<typeof wppOnMessageSchema>;
export type WppOnAck = z.infer<typeof wppOnAckSchema>;
