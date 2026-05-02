import { ProviderApiError } from '../../core/errors/provider-error.js';
import type {
  OutboundMessage,
  SendResult,
} from '../../core/types/outbound.js';

export interface MetaClientConfig {
  /** ID do número (não o WABA ID) */
  phoneNumberId: string;
  /** Permanent access token */
  accessToken: string;
  /** Versão da Graph API (default: v21.0) */
  graphApiVersion?: string;
  /** Override pra testes */
  fetchImpl?: typeof fetch;
  /** Base URL — default: https://graph.facebook.com */
  baseUrl?: string;
  /** Timeout em ms — default: 15_000 */
  timeoutMs?: number;
}

interface MetaSendResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

/**
 * Cliente HTTP para a Meta Cloud API (envio de mensagens).
 */
export class MetaClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly version: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: MetaClientConfig) {
    this.baseUrl = config.baseUrl ?? 'https://graph.facebook.com';
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.version = config.graphApiVersion ?? 'v21.0';
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  async sendMessage(
    to: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    const body = this.buildBody(to, message);
    const url = `${this.baseUrl}/${this.version}/${this.config.phoneNumberId}/messages`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new ProviderApiError(
        'meta',
        0,
        `Meta indisponível: ${(err as Error).message}`,
        err,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      throw new ProviderApiError(
        'meta',
        res.status,
        `Meta API error: ${res.status} ${res.statusText}`,
        json,
      );
    }

    const parsed = json as MetaSendResponse;
    const messageId = parsed.messages?.[0]?.id;
    if (!messageId) {
      throw new ProviderApiError(
        'meta',
        res.status,
        'Meta API response missing message id',
        json,
      );
    }

    return {
      providerMessageId: messageId,
      acceptedAt: new Date(),
      raw: json,
    };
  }

  private buildBody(to: string, message: OutboundMessage): unknown {
    const base = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
    };

    switch (message.type) {
      case 'text':
        return {
          ...base,
          type: 'text',
          text: { body: message.text, preview_url: false },
          ...(message.replyToMessageId && {
            context: { message_id: message.replyToMessageId },
          }),
        };

      case 'image':
      case 'audio':
      case 'video':
      case 'document': {
        const mediaPayload: Record<string, unknown> = { link: message.url };
        if (message.caption) mediaPayload.caption = message.caption;
        if (message.fileName && message.type === 'document') {
          mediaPayload.filename = message.fileName;
        }
        return {
          ...base,
          type: message.type,
          [message.type]: mediaPayload,
        };
      }

      case 'location':
        return {
          ...base,
          type: 'location',
          location: {
            latitude: message.latitude,
            longitude: message.longitude,
            name: message.name,
            address: message.address,
          },
        };
    }
  }
}
