import { ProviderApiError } from '../../core/errors/provider-error.js';
import type {
  OutboundMessage,
  SendResult,
} from '../../core/types/outbound.js';

export interface EvolutionGoClientConfig {
  /** URL base do servidor Evolution Go. Ex: http://localhost:4000 */
  baseUrl: string;
  /** Nome da instância (vai no header `instance`) */
  instance: string;
  /** API Key da instância (token gerado ao criar a instância) */
  apiKey: string;
  /** Override pra testes */
  fetchImpl?: typeof fetch;
}

interface EvoGoSendResponse {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  messageTimestamp?: number | string;
  status?: string;
}

/**
 * Cliente HTTP para a Evolution Go API.
 *
 * Diferenças vs evolution-baileys:
 * - Endpoints sob /send/* (não /message/*)
 * - Instância vai no header `instance`, não no path
 * - Quoted reply é via campo `id` raiz (per issue #29 da doc), não via objeto `quoted`
 * - Áudio usa /send/audio (não /send/whatsappAudio)
 */
export class EvolutionGoClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: EvolutionGoClientConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async sendMessage(
    to: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    const { endpoint, body } = this.buildRequest(to, message);
    const url = `${this.config.baseUrl}/${endpoint}`;

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        apikey: this.config.apiKey,
        instance: this.config.instance,
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
        'evolution-go',
        res.status,
        `Evolution Go API error: ${res.status} ${res.statusText}`,
        json,
      );
    }

    const parsed = json as EvoGoSendResponse;
    const messageId = parsed.key?.id;
    if (!messageId) {
      throw new ProviderApiError(
        'evolution-go',
        res.status,
        'Evolution Go API response missing key.id',
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
          endpoint: 'send/text',
          body: {
            number,
            text: message.text,
            // Evolution Go: quoted reply usa campo `id` na raiz (issue #29)
            ...(message.replyToMessageId && { id: message.replyToMessageId }),
          },
        };

      case 'image':
      case 'video':
      case 'document':
        return {
          endpoint: 'send/media',
          body: {
            number,
            mediatype: message.type,
            // No Evolution Go o campo é `url` (aceita URL ou base64 desde v0.7.0)
            url: message.url,
            caption: message.caption,
            fileName: message.type === 'document' ? message.fileName : undefined,
          },
        };

      case 'audio':
        return {
          endpoint: 'send/audio',
          body: {
            number,
            url: message.url,
          },
        };

      case 'location':
        return {
          endpoint: 'send/location',
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
