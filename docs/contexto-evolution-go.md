# Contexto do projeto para implementação evolution-go

## Estrutura completa src/
```
```


## src/adapters/evolution-baileys/evolution-baileys.client.ts
```typescript
import { ProviderApiError } from '../../core/errors/provider-error.js';
import type {
  OutboundMessage,
  SendResult,
} from '../../core/types/outbound.js';

export interface EvolutionClientConfig {
  /** URL base do servidor Evolution. Ex: https://evo.meusdr.com */
  baseUrl: string;
  /** Nome da instância (ex: "comercial-01") */
  instance: string;
  /** API Key global ou da instância */
  apiKey: string;
  /** Override pra testes */
  fetchImpl?: typeof fetch;
}

interface EvoSendResponse {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  messageTimestamp?: number | string;
  status?: string;
}

/**
 * Cliente HTTP para a Evolution API.
 * Cada tipo de mensagem tem seu próprio endpoint.
 */
export class EvolutionClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: EvolutionClientConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async sendMessage(
    to: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    const { endpoint, body } = this.buildRequest(to, message);
    const url = `${this.config.baseUrl}/${endpoint}/${this.config.instance}`;

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        apikey: this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      throw new ProviderApiError(
        'evolution',
        res.status,
        `Evolution API error: ${res.status} ${res.statusText}`,
        json,
      );
    }

    const parsed = json as EvoSendResponse;
    const messageId = parsed.key?.id;
    if (!messageId) {
      throw new ProviderApiError(
        'evolution',
        res.status,
        'Evolution API response missing key.id',
        json,
      );
    }

    return {
      providerMessageId: messageId,
      acceptedAt: new Date(),
      raw: json,
    };
  }

  private buildRequest(
    to: string,
    message: OutboundMessage,
  ): { endpoint: string; body: unknown } {
    const number = to;

    switch (message.type) {
      case 'text':
        return {
          endpoint: 'message/sendText',
          body: {
            number,
            text: message.text,
            ...(message.replyToMessageId && {
              quoted: { key: { id: message.replyToMessageId } },
            }),
          },
        };

      case 'image':
      case 'video':
      case 'document':
        return {
          endpoint: 'message/sendMedia',
          body: {
            number,
            mediatype: message.type,
            media: message.url,
            caption: message.caption,
            fileName: message.type === 'document' ? message.fileName : undefined,
          },
        };

      case 'audio':
        return {
          endpoint: 'message/sendWhatsAppAudio',
          body: {
            number,
            audio: message.url,
          },
        };

      case 'location':
        return {
          endpoint: 'message/sendLocation',
          body: {
            number,
            latitude: message.latitude,
            longitude: message.longitude,
            name: message.name,
            address: message.address,
          },
        };
    }
  }
}
```

## src/adapters/evolution-baileys/evolution-baileys.parser.ts
```typescript
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
} from './evolution-baileys.schemas.js';

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
    provider: 'evolution-baileys',
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
    provider: 'evolution-baileys',
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
```

## src/adapters/evolution-baileys/evolution-baileys.provider.ts
```typescript
import {
  WebhookSignatureError,
  WebhookValidationError,
} from '../../core/errors/provider-error.js';
import type {
  WebhookRequest,
  WhatsAppProvider,
} from '../../core/providers/provider.interface.js';
import type {
  NormalizedEvent,
  ProviderName,
} from '../../core/types/message.js';
import type {
  OutboundMessage,
  SendResult,
} from '../../core/types/outbound.js';
import {
  EvolutionClient,
  type EvolutionClientConfig,
} from './evolution-baileys.client.js';
import { parseEvolutionPayload } from './evolution-baileys.parser.js';
import { evoWebhookSchema } from './evolution-baileys.schemas.js';

export interface EvolutionProviderConfig extends EvolutionClientConfig {
  /**
   * Se definido, valida que o header `apikey` do webhook bate com este valor.
   * Evolution não usa HMAC — só reenvia a apikey configurada.
   */
  webhookApiKey?: string;
}

export class EvolutionProvider implements WhatsAppProvider {
  readonly name: ProviderName = 'evolution-baileys';
  private readonly client: EvolutionClient;

  constructor(private readonly config: EvolutionProviderConfig) {
    this.client = new EvolutionClient(config);
  }

  verifyWebhook(req: WebhookRequest): void {
    if (!this.config.webhookApiKey) return; // sem verificação configurada

    const headerKey = req.headers['apikey'];
    const received = Array.isArray(headerKey) ? headerKey[0] : headerKey;

    if (received !== this.config.webhookApiKey) {
      throw new WebhookSignatureError('evolution-baileys');
    }
  }

  parseWebhook(req: WebhookRequest): NormalizedEvent[] {
    const result = evoWebhookSchema.safeParse(req.body);
    if (!result.success) {
      // Eventos não suportados (ex: connection.update) → retorna vazio em vez de erro
      const body = req.body as { event?: string } | undefined;
      const knownButUnsupported = [
        'connection.update',
        'qrcode.updated',
        'presence.update',
        'contacts.update',
        'chats.update',
      ];
      if (body?.event && knownButUnsupported.includes(body.event)) {
        return [];
      }
      throw new WebhookValidationError('evolution-baileys', result.error.flatten());
    }
    return parseEvolutionPayload(result.data);
  }

  sendMessage(
    to: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    return this.client.sendMessage(to, message);
  }
}
```

## src/adapters/evolution-baileys/evolution-baileys.schemas.ts
```typescript
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
```

## src/adapters/evolution-baileys/index.ts
```typescript
export {
  EvolutionProvider,
  type EvolutionProviderConfig,
} from './evolution-baileys.provider.js';
export {
  EvolutionClient,
  type EvolutionClientConfig,
} from './evolution-baileys.client.js';
```

## src/core/providers/provider.interface.ts
```typescript
import type { NormalizedEvent, ProviderName } from '../types/message.js';
import type { OutboundMessage, SendResult } from '../types/outbound.js';

export interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  /** Raw body como string — necessário pra validação de assinatura HMAC */
  rawBody: string;
  body: unknown;
  query: Record<string, string | undefined>;
}

export interface ProviderConfig {
  /** ID da instância (multi-tenant) */
  instanceId: string;
  /** Credenciais específicas do provider */
  credentials: Record<string, string>;
}

/**
 * Contrato único que todos os providers de WhatsApp devem implementar.
 * Adicionar um novo provider = criar uma nova classe que implementa essa interface.
 */
export interface WhatsAppProvider {
  readonly name: ProviderName;

  /**
   * Valida assinatura/token do webhook.
   * Lança WebhookSignatureError se inválido.
   */
  verifyWebhook(req: WebhookRequest): void;

  /**
   * GET de verificação inicial (Meta usa challenge token).
   * Retorna o body que deve ser respondido, ou null se não aplicável.
   */
  handleVerification?(req: WebhookRequest): string | null;

  /**
   * Converte payload bruto do provider em eventos normalizados.
   * Um único webhook pode conter múltiplos eventos (mensagens + status).
   */
  parseWebhook(req: WebhookRequest): NormalizedEvent[];

  /**
   * Envia mensagem via API do provider.
   */
  sendMessage(to: string, message: OutboundMessage): Promise<SendResult>;
}
```

## src/core/providers/index.ts
```typescript
export * from './provider.interface.js';
```

## src/core/registry/provider-registry.ts
```typescript
import type { ProviderName } from '../types/message.js';
import type { WhatsAppProvider } from '../providers/provider.interface.js';

/**
 * Registry simples — resolve provider por nome + instância.
 * Em produção pode evoluir pra carregar configs do DB.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, WhatsAppProvider>();

  private key(name: ProviderName, instanceId: string): string {
    return `${name}:${instanceId}`;
  }

  register(instanceId: string, provider: WhatsAppProvider): void {
    this.providers.set(this.key(provider.name, instanceId), provider);
  }

  get(name: ProviderName, instanceId: string): WhatsAppProvider {
    const provider = this.providers.get(this.key(name, instanceId));
    if (!provider) {
      throw new Error(`Provider not registered: ${name}:${instanceId}`);
    }
    return provider;
  }

  has(name: ProviderName, instanceId: string): boolean {
    return this.providers.has(this.key(name, instanceId));
  }

  list(): Array<{ name: ProviderName; instanceId: string }> {
    return Array.from(this.providers.keys()).map((key) => {
      const [name, instanceId] = key.split(':') as [ProviderName, string];
      return { name, instanceId };
    });
  }
}
```

## src/core/registry/index.ts
```typescript
export * from './provider-registry.js';
```

## src/core/errors/provider-error.ts
```typescript
/**
 * Erros tipados — facilita tratamento no HTTP layer e em testes.
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class WebhookValidationError extends ProviderError {
  constructor(provider: string, cause?: unknown) {
    super('Invalid webhook payload', provider, 'WEBHOOK_VALIDATION', cause);
    this.name = 'WebhookValidationError';
  }
}

export class WebhookSignatureError extends ProviderError {
  constructor(provider: string) {
    super('Invalid webhook signature', provider, 'WEBHOOK_SIGNATURE');
    this.name = 'WebhookSignatureError';
  }
}

export class ProviderApiError extends ProviderError {
  constructor(
    provider: string,
    public readonly httpStatus: number,
    message: string,
    cause?: unknown,
  ) {
    super(message, provider, 'PROVIDER_API', cause);
    this.name = 'ProviderApiError';
  }
}

export class UnsupportedFeatureError extends ProviderError {
  constructor(provider: string, feature: string) {
    super(
      `Provider "${provider}" does not support "${feature}"`,
      provider,
      'UNSUPPORTED_FEATURE',
    );
    this.name = 'UnsupportedFeatureError';
  }
}
```

## src/core/errors/index.ts
```typescript
export * from './provider-error.js';
```

## src/core/types/message.ts
```typescript
/**
 * Tipos normalizados — formato canônico independente do provider.
 * Todo adapter (Meta, Evolution, WPPConnect, Z-API) converte PARA esses tipos.
 */

export type ProviderName = 'meta' | 'evolution-baileys' | 'wppconnect' | 'zapi';

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
```

## src/core/types/outbound.ts
```typescript
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
```

## src/core/types/index.ts
```typescript
export * from './message.js';
export * from './outbound.js';
```

## Conteúdo de src/core/domain/ (se existir)

## Teste de referência: evolution-baileys.provider.test.ts
```typescript
import { describe, expect, it } from 'vitest';
import { EvolutionProvider } from '../../../adapters/evolution-baileys/evolution-baileys.provider.js';
import { WebhookSignatureError } from '../../../core/errors/provider-error.js';

function makeProvider(webhookApiKey?: string) {
  return new EvolutionProvider({
    baseUrl: 'http://fake',
    instance: 'comercial-01',
    apiKey: 'send-key',
    webhookApiKey,
  });
}

describe('EvolutionProvider.verifyWebhook', () => {
  it('passa quando webhookApiKey não configurado', () => {
    const p = makeProvider();
    expect(() =>
      p.verifyWebhook({ rawBody: '', body: {}, headers: {}, query: {} }),
    ).not.toThrow();
  });

  it('passa quando apikey bate', () => {
    const p = makeProvider('secret-123');
    expect(() =>
      p.verifyWebhook({
        rawBody: '',
        body: {},
        headers: { apikey: 'secret-123' },
        query: {},
      }),
    ).not.toThrow();
  });

  it('lança quando apikey não bate', () => {
    const p = makeProvider('secret-123');
    expect(() =>
      p.verifyWebhook({
        rawBody: '',
        body: {},
        headers: { apikey: 'wrong' },
        query: {},
      }),
    ).toThrow(WebhookSignatureError);
  });
});

describe('EvolutionProvider.parseWebhook', () => {
  it('retorna [] para connection.update (evento não suportado)', () => {
    const p = makeProvider();
    const events = p.parseWebhook({
      rawBody: '',
      body: { event: 'connection.update', instance: 'x', data: {} },
      headers: {},
      query: {},
    });
    expect(events).toEqual([]);
  });

  it('parseia messages.upsert válido', () => {
    const p = makeProvider();
    const events = p.parseWebhook({
      rawBody: '',
      body: {
        event: 'messages.upsert',
        instance: 'comercial-01',
        data: {
          key: { remoteJid: '5547988887777@s.whatsapp.net', fromMe: false, id: 'X' },
          message: { conversation: 'oi' },
          messageTimestamp: 1700000000,
        },
      },
      headers: {},
      query: {},
    });
    expect(events).toHaveLength(1);
  });
});
```

## Teste de referência: evolution-baileys.client.test.ts
```typescript
import { describe, it, expect, vi } from 'vitest';
import { EvolutionClient } from '../../../adapters/evolution-baileys/evolution-baileys.client.js';
import { ProviderApiError } from '../../../core/errors/provider-error.js';

function makeClient(fetchImpl: typeof fetch) {
  return new EvolutionClient({
    baseUrl: 'https://evo.test',
    instance: 'inst-1',
    apiKey: 'key-abc',
    fetchImpl,
  });
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    statusText: 'Bad Request',
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('EvolutionClient', () => {
  it('envia texto e retorna SendResult', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'evo-1' } }),
    ) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'oi',
    });

    expect(result.providerMessageId).toBe('evo-1');
    expect(result.acceptedAt).toBeInstanceOf(Date);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe('https://evo.test/message/sendText/inst-1');
    expect((init as RequestInit).headers).toMatchObject({ apikey: 'key-abc' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ number: '5547', text: 'oi' });
  });

  it('envia texto com quoted quando replyToMessageId presente', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'q' } }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'reply',
      replyToMessageId: 'orig-id',
    });

    const body = JSON.parse(
      ((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as RequestInit).body as string,
    );
    expect(body.quoted).toEqual({ key: { id: 'orig-id' } });
  });

  it.each(['image', 'video'] as const)(
    'envia mídia %s no endpoint sendMedia',
    async (type) => {
      const fetchImpl = vi.fn().mockResolvedValue(
        okResponse({ key: { id: 'm' } }),
      ) as unknown as typeof fetch;

      await makeClient(fetchImpl).sendMessage('5547', {
        type,
        url: 'https://x/file',
        caption: 'cap',
      } as never);

      const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect(url).toBe('https://evo.test/message/sendMedia/inst-1');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.mediatype).toBe(type);
      expect(body.media).toBe('https://x/file');
      expect(body.caption).toBe('cap');
    },
  );

  it('envia document com fileName', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'd' } }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'document',
      url: 'https://x/f.pdf',
      fileName: 'f.pdf',
    });

    const body = JSON.parse(
      ((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as RequestInit).body as string,
    );
    expect(body.fileName).toBe('f.pdf');
  });

  it('envia áudio no endpoint sendWhatsAppAudio', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'a' } }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'audio',
      url: 'https://x/a.ogg',
    });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe('https://evo.test/message/sendWhatsAppAudio/inst-1');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.audio).toBe('https://x/a.ogg');
  });

  it('envia location', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'l' } }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'location',
      latitude: -26.9,
      longitude: -49.0,
      name: 'BNU',
      address: 'SC',
    });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe('https://evo.test/message/sendLocation/inst-1');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.latitude).toBe(-26.9);
    expect(body.name).toBe('BNU');
  });

  it('lança ProviderApiError em resposta não-ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      errResponse(401, { error: 'unauthorized' }),
    ) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });

  it('lança ProviderApiError quando response não tem key.id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ status: 'ok' }),
    ) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toThrowError(/missing key\.id/);
  });

  it('lida com body vazio na resposta', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'ISE',
      text: async () => '',
    } as unknown as Response) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });

  it('lida com body não-JSON na resposta', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => '<html>oops</html>',
    } as unknown as Response) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });
});
```

## Teste de referência: evolution-baileys.parser.test.ts
```typescript
import { describe, expect, it } from 'vitest';
import { parseEvolutionPayload } from '../../../adapters/evolution-baileys/evolution-baileys.parser.js';
import { evoWebhookSchema } from '../../../adapters/evolution-baileys/evolution-baileys.schemas.js';

function upsert(messageContent: Record<string, unknown>, opts: Partial<{ fromMe: boolean; pushName: string; id: string }> = {}) {
  return {
    event: 'messages.upsert',
    instance: 'comercial-01',
    data: {
      key: {
        remoteJid: '5547988887777@s.whatsapp.net',
        fromMe: opts.fromMe ?? false,
        id: opts.id ?? 'EVO_MSG_1',
      },
      pushName: opts.pushName ?? 'Felipe',
      message: messageContent,
      messageTimestamp: 1700000000,
    },
  };
}

describe('parseEvolutionPayload', () => {
  it('parseia conversation (texto simples)', () => {
    const raw = upsert({ conversation: 'oi tudo bem?' });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));

    expect(events).toHaveLength(1);
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data).toMatchObject({
      provider: 'evolution-baileys',
      providerMessageId: 'EVO_MSG_1',
      providerInstanceId: 'comercial-01',
      direction: 'inbound',
      type: 'text',
      text: 'oi tudo bem?',
      from: { phone: '5547988887777', name: 'Felipe' },
    });
  });

  it('parseia extendedTextMessage com reply', () => {
    const raw = upsert({
      extendedTextMessage: {
        text: 'respondendo',
        contextInfo: { stanzaId: 'ORIGINAL_ID' },
      },
    });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.text).toBe('respondendo');
    expect(events[0].data.replyToMessageId).toBe('ORIGINAL_ID');
  });

  it('parseia imagem com caption', () => {
    const raw = upsert({
      imageMessage: {
        url: 'https://cdn/image.jpg',
        mimetype: 'image/jpeg',
        caption: 'olha isso',
      },
    });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('image');
    expect(events[0].data.media?.url).toBe('https://cdn/image.jpg');
    expect(events[0].data.text).toBe('olha isso');
  });

  it('marca outbound quando fromMe=true', () => {
    const raw = upsert({ conversation: 'eu enviei' }, { fromMe: true });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.direction).toBe('outbound');
    expect(events[0].data.to.phone).toBe('5547988887777');
  });

  it('parseia status DELIVERY_ACK como delivered', () => {
    const raw = {
      event: 'messages.update',
      instance: 'comercial-01',
      data: {
        keyId: 'EVO_MSG_1',
        remoteJid: '5547988887777@s.whatsapp.net',
        fromMe: true,
        status: 'DELIVERY_ACK',
      },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    expect(events).toHaveLength(1);
    if (events[0].kind !== 'status') throw new Error();
    expect(events[0].data.status).toBe('delivered');
    expect(events[0].data.providerMessageId).toBe('EVO_MSG_1');
  });

  it('mapeia READ → read', () => {
    const raw = {
      event: 'messages.update',
      instance: 'comercial-01',
      data: { keyId: 'X', status: 'READ' },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'status') throw new Error();
    expect(events[0].data.status).toBe('read');
  });

  it('mapeia ERROR → failed', () => {
    const raw = {
      event: 'messages.update',
      instance: 'comercial-01',
      data: { keyId: 'X', status: 'ERROR' },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'status') throw new Error();
    expect(events[0].data.status).toBe('failed');
  });

  it('ignora status desconhecido', () => {
    const raw = {
      event: 'messages.update',
      instance: 'comercial-01',
      data: { keyId: 'X', status: 'WEIRD_STATUS' },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    expect(events).toHaveLength(0);
  });

  it('parseia location', () => {
    const raw = upsert({
      locationMessage: {
        degreesLatitude: -26.9194,
        degreesLongitude: -49.0661,
        name: 'Blumenau',
      },
    });
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.type).toBe('location');
    expect(events[0].data.location).toMatchObject({
      latitude: -26.9194,
      longitude: -49.0661,
      name: 'Blumenau',
    });
  });

  it('detecta grupo via @g.us', () => {
    const raw = {
      event: 'messages.upsert',
      instance: 'comercial-01',
      data: {
        key: {
          remoteJid: '120363xxx@g.us',
          fromMe: false,
          id: 'GRP_MSG',
          participant: '5547988887777@s.whatsapp.net',
        },
        pushName: 'Alguém',
        message: { conversation: 'oi grupo' },
        messageTimestamp: 1700000000,
      },
    };
    const events = parseEvolutionPayload(evoWebhookSchema.parse(raw));
    if (events[0].kind !== 'message') throw new Error();
    expect(events[0].data.from.isGroup).toBe(true);
  });
});
```
