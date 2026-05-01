import type { IntentRepository } from '../../core/repositories/intent-repository.js';
import type { IntentResult } from '../../core/ports/intent-classifier.js';

export interface StoredIntent {
  messageEventId: string;
  result: IntentResult;
  classifiedAt: Date;
}

/**
 * Repositório in-memory pra dev/CI sem Postgres.
 * Reclassificação sobrescreve (mesma semântica do Postgres).
 */
export class InMemoryIntentRepository implements IntentRepository {
  private readonly store = new Map<string, StoredIntent>();

  async saveIntent(messageEventId: string, result: IntentResult): Promise<void> {
    this.store.set(messageEventId, {
      messageEventId,
      result,
      classifiedAt: new Date(),
    });
  }

  /** Util pra testes / inspeção */
  get(messageEventId: string): StoredIntent | undefined {
    return this.store.get(messageEventId);
  }

  snapshot(): ReadonlyArray<StoredIntent> {
    return Array.from(this.store.values());
  }

  clear(): void {
    this.store.clear();
  }
}
