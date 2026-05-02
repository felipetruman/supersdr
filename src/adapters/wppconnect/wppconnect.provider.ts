import {
  WebhookSignatureError,
  WebhookValidationError,
} from '../../core/errors/provider-error.js';
import type {
  WebhookRequest,
  WhatsAppProvider,
} from '../../core/providers/provider.interface.js';
import type { NormalizedEvent } from '../../core/types/message.js';
import type { OutboundMessage, SendResult } from '../../core/types/outbound.js';
import { WppClient, type WppClientConfig } from './wppconnect.client.js';
import { parseWppPayload } from './wppconnect.parser.js';
import { wppWebhookSchema } from './wppconnect.schemas.js';

export interface WppConnectProviderConfig extends WppClientConfig {
  /**
   * Segredo opcional para validar webhooks.
   * WPPConnect-server não tem auth nativa — recomenda-se header customizado
   * (ex: X-Webhook-Secret) injetado por reverse proxy ou edge function.
   */
  webhookSecret?: string;
  /** Header onde o segredo deve chegar. Default: 'x-webhook-secret' */
  webhookSecretHeader?: string;
}

export class WppConnectProvider implements WhatsAppProvider {
  readonly name = 'wppconnect' as const;
  private readonly client: WppClient;
  private readonly webhookSecret?: string;
  private readonly secretHeader: string;
  private readonly sessionId: string;

  constructor(cfg: WppConnectProviderConfig) {
    this.client = new WppClient(cfg);
    this.webhookSecret = cfg.webhookSecret;
    this.secretHeader = (cfg.webhookSecretHeader ?? 'x-webhook-secret').toLowerCase();
    this.sessionId = cfg.session;
  }

  verifyWebhook(req: WebhookRequest): void {
    if (!this.webhookSecret) return; // bypass quando não configurado

    const headers = req.headers ?? {};
    const got = headers[this.secretHeader];
    const provided = Array.isArray(got) ? got[0] : got;

    if (!provided || provided !== this.webhookSecret) {
      throw new WebhookSignatureError('wppconnect');
    }
  }

  parseWebhook(req: WebhookRequest): NormalizedEvent[] {
    const result = wppWebhookSchema.safeParse(req.body);
    if (!result.success) {
      throw new WebhookValidationError('wppconnect', result.error.flatten());
    }
    return parseWppPayload(
      result.data as { event: string } & Record<string, unknown>,
      this.sessionId,
    );
  }

  sendMessage(to: string, message: OutboundMessage): Promise<SendResult> {
    return this.client.sendMessage(to, message);
  }
}
