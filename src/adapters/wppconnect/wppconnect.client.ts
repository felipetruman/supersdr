import { ProviderApiError, UnsupportedFeatureError } from '../../core/errors/provider-error.js';
import type { OutboundMessage, SendResult } from '../../core/types/outbound.js';

export interface WppClientConfig {
  /** Ex: http://localhost:21465 */
  baseUrl: string;
  /** Nome da sessão (ex: 'NERDWHATS_AMERICA') */
  session: string;
  /** Bearer token gerado via /api/:session/:secretkey/generate-token */
  token: string;
  timeoutMs?: number;
  /** Override pra testes */
  fetchImpl?: typeof fetch;
}

interface WppSendBody {
  phone: string;
  message?: string;
  isGroup?: boolean;
  [k: string]: unknown;
}

/**
 * Cliente HTTP para wppconnect-server.
 * Endpoints: https://wppconnect.io/swagger/wppconnect-server/
 */
export class WppClient {
  constructor(private readonly cfg: WppClientConfig) {}

  async sendMessage(to: string, message: OutboundMessage): Promise<SendResult> {
    const phone = to.replace(/\D/g, '');
    const isGroup = phone.length > 15; // IDs de grupo são longos

    let endpoint: string;
    let body: WppSendBody;

    switch (message.type) {
      case 'text':
        endpoint = '/send-message';
        body = { phone, message: message.text, isGroup };
        break;

      case 'image':
        endpoint = '/send-image';
        body = {
          phone,
          path: message.url,
          filename: message.fileName ?? 'image',
          caption: message.caption ?? '',
          isGroup,
        };
        break;

      case 'audio':
        endpoint = '/send-voice';
        body = { phone, path: message.url, isGroup };
        break;

      case 'video':
      case 'document':
        endpoint = '/send-file';
        body = {
          phone,
          path: message.url,
          filename: message.fileName ?? message.type,
          caption: message.caption ?? '',
          isGroup,
        };
        break;

      case 'location':
        endpoint = '/send-location';
        body = {
          phone,
          lat: String(message.latitude),
          lng: String(message.longitude),
          title: message.name ?? '',
          address: message.address ?? '',
          isGroup,
        };
        break;

      default: {
        const _exhaustive: never = message;
        throw new UnsupportedFeatureError(
          'wppconnect',
          `Tipo de mensagem não suportado: ${JSON.stringify(_exhaustive)}`,
        );
      }
    }

    return this.post(endpoint, body);
  }

  private async post(endpoint: string, body: WppSendBody): Promise<SendResult> {
    const url = `${this.cfg.baseUrl}/api/${this.cfg.session}${endpoint}`;
    const doFetch = this.cfg.fetchImpl ?? fetch;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 15_000);

    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.cfg.token}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new ProviderApiError(
        'wppconnect',
        0,
        `WPPConnect indisponível: ${(err as Error).message}`,
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
        'wppconnect',
        res.status,
        `WPPConnect API error ${res.status}`,
        json,
      );
    }

    // wppconnect-server retorna { status: 'success', response: { id, ... } }
    const payload = json as {
      response?: { id?: string | { _serialized?: string } };
      id?: string | { _serialized?: string };
    };
    const respId = payload.response?.id ?? payload.id;
    let providerMessageId = '';
    if (typeof respId === 'string') {
      providerMessageId = respId;
    } else if (respId && typeof respId === 'object' && respId._serialized) {
      providerMessageId = respId._serialized;
    }

    return {
      providerMessageId,
      acceptedAt: new Date(),
      raw: json,
    };
  }
}
