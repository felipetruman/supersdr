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
  /** Timeout em ms — default: 15_000 */
  timeoutMs?: number;
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
  private readonly timeoutMs: number;

  constructor(private readonly config: EvolutionClientConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  async sendMessage(
    to: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    const { endpoint, body } = this.buildRequest(to, message);
    const url = `${this.config.baseUrl}/${endpoint}/${this.config.instance}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          apikey: this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new ProviderApiError(
        'evolution',
        0,
        `Evolution indisponível: ${(err as Error).message}`,
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
