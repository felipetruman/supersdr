import { ProviderApiError } from '../../core/errors/provider-error.js';
import type {
  OutboundMessage,
  SendResult,
} from '../../core/types/outbound.js';

/**
 * Configuração do client Z-API.
 *
 * Endpoints: https://api.z-api.io/instances/{instanceId}/token/{instanceToken}/{method}
 * Auth: header "Client-Token" com o token DA CONTA (≠ instanceToken da URL!)
 *
 * Doc: https://developer.z-api.io/message/send-message-text
 */
export interface ZapiClientConfig {
  /** ID da instância (vem do painel Z-API) */
  instanceId: string;
  /** Token DA INSTÂNCIA (vai na URL) */
  instanceToken: string;
  /** Token DE SEGURANÇA DA CONTA (vai no header Client-Token) */
  clientToken: string;
  /** Override opcional da base URL — útil para testes */
  baseUrl?: string;
  /** fetch injetável para testes */
  fetchImpl?: typeof fetch;
}

interface ZapiSendResponse {
  zaapId?: string;
  messageId?: string;
  id?: string;
}

const DEFAULT_BASE_URL = 'https://api.z-api.io';

export class ZapiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly cfg: ZapiClientConfig) {
    this.baseUrl = cfg.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async sendMessage(
    to: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    const phone = stripJidSuffix(to);

    switch (message.type) {
      case 'text':
        return this.post('send-text', {
          phone,
          message: message.text,
        });

      case 'image':
        return this.post('send-image', {
          phone,
          image: message.url,
          caption: message.caption,
        });

      case 'audio':
        return this.post('send-audio', {
          phone,
          audio: message.url,
        });

      case 'video':
        return this.post('send-video', {
          phone,
          video: message.url,
          caption: message.caption,
        });

      case 'document': {
        // Z-API exige extensão NA URL: /send-document/{ext}
        const ext = inferExtension(message.fileName, message.url);
        return this.post(`send-document/${ext}`, {
          phone,
          document: message.url,
          fileName: message.fileName,
          caption: message.caption,
        });
      }

      case 'location':
        return this.post('send-location', {
          phone,
          title: message.name ?? '',
          address: message.address ?? '',
          latitude: String(message.latitude),
          longitude: String(message.longitude),
        });

      default: {
        const _exhaustive: never = message;
        throw new ProviderApiError(
          'zapi',
          400,
          `Tipo de mensagem não suportado: ${(_exhaustive as { type: string }).type}`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // HTTP plumbing
  // -------------------------------------------------------------------------

  private async post(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<SendResult> {
    const url = this.buildUrl(endpoint);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.cfg.clientToken,
        },
        body: JSON.stringify(stripUndefined(body)),
      });
    } catch (cause) {
      throw new ProviderApiError('zapi', 0, 'Falha de rede ao chamar Z-API', cause);
    }

    const rawText = await response.text();

    if (!response.ok) {
      throw new ProviderApiError(
        'zapi',
        response.status,
        `Z-API retornou ${response.status}: ${rawText}`,
      );
    }

    let parsed: ZapiSendResponse;
    try {
      parsed = rawText ? (JSON.parse(rawText) as ZapiSendResponse) : {};
    } catch (cause) {
      throw new ProviderApiError(
        'zapi',
        response.status,
        `Resposta da Z-API não é JSON válido: ${rawText}`,
        cause,
      );
    }

    const providerMessageId = parsed.messageId ?? parsed.id ?? parsed.zaapId;
    if (!providerMessageId) {
      throw new ProviderApiError(
        'zapi',
        response.status,
        `Z-API retornou 200 sem messageId/zaapId: ${rawText}`,
      );
    }

    return {
      providerMessageId,
      acceptedAt: new Date(),
      raw: parsed,
    };
  }

  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}/instances/${this.cfg.instanceId}/token/${this.cfg.instanceToken}/${endpoint}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripJidSuffix(phone: string): string {
  const at = phone.indexOf('@');
  return at === -1 ? phone : phone.slice(0, at);
}

function inferExtension(fileName: string | undefined, url: string): string {
  const fromName = fileName?.split('.').pop();
  if (fromName && fromName !== fileName) return fromName.toLowerCase();

  const fromUrl = url.split('?')[0]?.split('.').pop();
  if (fromUrl && fromUrl.length <= 5) return fromUrl.toLowerCase();

  return 'pdf';
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}
