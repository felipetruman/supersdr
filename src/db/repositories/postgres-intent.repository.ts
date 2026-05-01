import type { Sql } from 'postgres';
import type { IntentRepository } from '../../core/repositories/intent-repository.js';
import type { IntentResult } from '../../core/ports/intent-classifier.js';

/**
 * Persiste classificação via UPDATE na linha de message_events.
 * Reclassificações sobrescrevem (sem histórico nesta versão).
 */
export class PostgresIntentRepository implements IntentRepository {
  constructor(private readonly sql: Sql) {}

  async saveIntent(messageEventId: string, result: IntentResult): Promise<void> {
    await this.sql`
      UPDATE message_events
      SET
        intent               = ${result.intent},
        intent_confidence    = ${result.confidence},
        intent_provider      = ${result.provider},
        intent_model         = ${result.model ?? null},
        intent_classified_at = NOW()
      WHERE id = ${messageEventId}
    `;
  }
}
