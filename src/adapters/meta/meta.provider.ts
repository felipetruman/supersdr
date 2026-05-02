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
import { MetaClient, type MetaClientConfig } from './meta.client.js';
import { parseMetaPayload } from './meta.parser.js';
import { metaWebhookSchema } from './meta.schemas.js';
import { verifyMetaSignature } from './meta.signature.js';

export interface MetaProviderConfig extends MetaClientConfig {
  /** Token de verificação configurado no painel da Meta */
  verifyToken: string;
  /** App secret pra validar assinatura HMAC */
  appSecret: string;
}

export class MetaProvider implements WhatsAppProvider {
  readonly name: ProviderName = 'meta';
  private readonly client: MetaClient;

  constructor(private readonly config: MetaProviderConfig) {
    this.client = new MetaClient(config);
  }

  /**
   * GET /webhook — challenge inicial de verificação.
   * Retorna o hub.challenge se o token bater, senão null.
   */
  handleVerification(req: WebhookRequest): string | null {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === this.config.verifyToken) {
      return challenge ?? null;
    }
    return null;
  }

  verifyWebhook(req: WebhookRequest): void {
    const sig = req.headers['x-hub-signature-256'];
    const sigStr = Array.isArray(sig) ? sig[0] : sig;

    const ok = verifyMetaSignature(
      req.rawBody,
      sigStr,
      this.config.appSecret,
    );
    if (!ok) {
      throw new WebhookSignatureError('meta');
    }
  }

  parseWebhook(req: WebhookRequest): NormalizedEvent[] {
    const result = metaWebhookSchema.safeParse(req.body);
    if (!result.success) {
      throw new WebhookValidationError('meta', result.error.flatten());
    }
    return parseMetaPayload(result.data);
  }

  sendMessage(
    to: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    return this.client.sendMessage(to, message);
  }
}
