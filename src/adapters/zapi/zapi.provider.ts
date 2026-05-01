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
import { ZapiClient, type ZapiClientConfig } from './zapi.client.js';
import { parseZapiPayload } from './zapi.parser.js';
import { zapiWebhookSchema } from './zapi.schemas.js';

export interface ZapiProviderConfig extends ZapiClientConfig {
  /**
   * Se definido, valida que o header `Client-Token` do webhook recebido
   * bate com este valor. Z-API reenvia o mesmo clientToken da conta nos webhooks.
   * Recomendado em produção.
   */
  webhookClientToken?: string;
}

/**
 * Eventos que a Z-API envia mas que NÃO são mensagens nem status —
 * retornamos array vazio em vez de WebhookValidationError.
 *
 * Doc: https://developer.z-api.io/webhooks/introduction
 */
const KNOWN_BUT_UNSUPPORTED_TYPES = [
  'ConnectedCallback',
  'DisconnectedCallback',
  'PresenceChatCallback',
  'NotificationCallback',
  'ChatPresenceCallback',
] as const;

export class ZapiProvider implements WhatsAppProvider {
  readonly name: ProviderName = 'zapi';
  private readonly client: ZapiClient;

  constructor(private readonly config: ZapiProviderConfig) {
    this.client = new ZapiClient(config);
  }

  verifyWebhook(req: WebhookRequest): void {
    if (!this.config.webhookClientToken) return; // sem verificação configurada

    // Headers podem vir lowercase dependendo do framework HTTP
    const headerToken =
      req.headers['client-token'] ?? req.headers['Client-Token'];
    const received = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (received !== this.config.webhookClientToken) {
      throw new WebhookSignatureError('zapi');
    }
  }

  parseWebhook(req: WebhookRequest): NormalizedEvent[] {
    const result = zapiWebhookSchema.safeParse(req.body);
    if (!result.success) {
      // Eventos conhecidos mas não suportados → retorna vazio em vez de erro
      const body = req.body as { type?: string } | undefined;
      if (
        body?.type &&
        (KNOWN_BUT_UNSUPPORTED_TYPES as readonly string[]).includes(body.type)
      ) {
        return [];
      }
      throw new WebhookValidationError('zapi', result.error.flatten());
    }
    return parseZapiPayload(result.data);
  }

  sendMessage(to: string, message: OutboundMessage): Promise<SendResult> {
    return this.client.sendMessage(to, message);
  }
}
