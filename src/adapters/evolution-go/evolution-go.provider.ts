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
  EvolutionGoClient,
  type EvolutionGoClientConfig,
} from './evolution-go.client.js';
import { parseEvolutionGoPayload } from './evolution-go.parser.js';
import { evoGoWebhookSchema } from './evolution-go.schemas.js';

export interface EvolutionGoProviderConfig extends EvolutionGoClientConfig {
  /**
   * Se definido, valida que o header `apikey` do webhook bate com este valor.
   * Evolution Go reenvia a apikey configurada no webhook (não usa HMAC).
   */
  webhookApiKey?: string;
}

export class EvolutionGoProvider implements WhatsAppProvider {
  readonly name: ProviderName = 'evolution-go';
  private readonly client: EvolutionGoClient;

  constructor(private readonly config: EvolutionGoProviderConfig) {
    this.client = new EvolutionGoClient(config);
  }

  verifyWebhook(req: WebhookRequest): void {
    if (!this.config.webhookApiKey) return;

    const headerKey = req.headers['apikey'];
    const received = Array.isArray(headerKey) ? headerKey[0] : headerKey;

    if (received !== this.config.webhookApiKey) {
      throw new WebhookSignatureError('evolution-go');
    }
  }

  parseWebhook(req: WebhookRequest): NormalizedEvent[] {
    const result = evoGoWebhookSchema.safeParse(req.body);
    if (!result.success) {
      // Eventos não suportados → retorna vazio em vez de erro
      const body = req.body as { event?: string } | undefined;
      const knownButUnsupported = [
        'connection.update',
        'qrcode.updated',
        'presence.update',
        'contacts.update',
        'chats.update',
        'send.message',
      ];
      if (body?.event && knownButUnsupported.includes(body.event)) {
        return [];
      }
      throw new WebhookValidationError('evolution-go', result.error.flatten());
    }
    return parseEvolutionGoPayload(result.data);
  }

  sendMessage(
    to: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    return this.client.sendMessage(to, message);
  }
}
