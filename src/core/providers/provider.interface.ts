import type { NormalizedEvent, ProviderName } from '../types/message.js';
import type { OutboundMessage, SendResult } from '../types/outbound.js';

export interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  /** Raw body como string — necessário pra validação de assinatura HMAC */
  rawBody: string;
  body: unknown;
  query: Record<string, string | undefined>;
}

export interface ProviderConfig {
  /** ID da instância (multi-tenant) */
  instanceId: string;
  /** Credenciais específicas do provider */
  credentials: Record<string, string>;
}

/**
 * Contrato único que todos os providers de WhatsApp devem implementar.
 * Adicionar um novo provider = criar uma nova classe que implementa essa interface.
 */
export interface WhatsAppProvider {
  readonly name: ProviderName;

  /**
   * Valida assinatura/token do webhook.
   * Lança WebhookSignatureError se inválido.
   */
  verifyWebhook(req: WebhookRequest): void;

  /**
   * GET de verificação inicial (Meta usa challenge token).
   * Retorna o body que deve ser respondido, ou null se não aplicável.
   */
  handleVerification?(req: WebhookRequest): string | null;

  /**
   * Converte payload bruto do provider em eventos normalizados.
   * Um único webhook pode conter múltiplos eventos (mensagens + status).
   */
  parseWebhook(req: WebhookRequest): NormalizedEvent[];

  /**
   * Envia mensagem via API do provider.
   */
  sendMessage(to: string, message: OutboundMessage): Promise<SendResult>;
}
