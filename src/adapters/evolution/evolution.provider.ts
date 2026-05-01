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
} from './evolution.client.js';
import { parseEvolutionPayload } from './evolution.parser.js';
import { evoWebhookSchema } from './evolution.schemas.js';

export interface EvolutionProviderConfig extends EvolutionClientConfig {
  /**
   * Se definido, valida que o header `apikey` do webhook bate com este valor.
   * Evolution não usa HMAC — só reenvia a apikey configurada.
   */
  webhookApiKey?: string;
}

export class EvolutionProvider implements WhatsAppProvider {
  readonly name: ProviderName = 'evolution';
  private readonly client: EvolutionClient;

  constructor(private readonly config: EvolutionProviderConfig) {
    this.client = new EvolutionClient(config);
  }

  verifyWebhook(req: WebhookRequest): void {
    if (!this.config.webhookApiKey) return; // sem verificação configurada

    const headerKey = req.headers['apikey'];
    const received = Array.isArray(headerKey) ? headerKey[0] : headerKey;

    if (received !== this.config.webhookApiKey) {
      throw new WebhookSignatureError('evolution');
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
      throw new WebhookValidationError('evolution', result.error.flatten());
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
