import type { IntentResult } from '../ports/intent-classifier.js';

/**
 * Porta de persistência da classificação de intenção.
 * Implementações: in-memory (dev/teste) e Postgres (prod).
 *
 * Idempotência: UPDATE no message_events.id (1 evento → 1 classificação).
 * Reclassificações sobrescrevem (não há histórico nesta versão).
 */
export interface IntentRepository {
  saveIntent(messageEventId: string, result: IntentResult): Promise<void>;
}
