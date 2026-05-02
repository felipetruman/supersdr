import type { NormalizedEvent, ProviderName } from '../types/message.js';

export interface SaveEventInput {
  provider: ProviderName;
  instanceId: string;
  event: NormalizedEvent;
  rawPayload: unknown;
}

export interface SaveEventResult {
  /** `true` quando inseriu; `false` quando deduplicou via UNIQUE */
  created: boolean;
  /** ID interno (UUID) do registro persistido */
  id: string;
}

/**
 * Porta de persistência. Implementações: in-memory (dev/teste) e Postgres (prod).
 * Idempotência: chave UNIQUE (provider, instance_id, providerMessageId).
 */
export interface MessageRepository {
  saveEvent(input: SaveEventInput): Promise<SaveEventResult>;
}
