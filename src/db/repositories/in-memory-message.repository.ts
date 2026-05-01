import { randomUUID } from 'node:crypto';
import type {
  MessageRepository,
  SaveEventInput,
  SaveEventResult,
} from '../../core/repositories/message-repository.js';

/**
 * Repository in-memory pra rodar E2E sem Postgres.
 * Mesma semântica de idempotência: chave composta provider+instance+messageId.
 */
export class InMemoryMessageRepository implements MessageRepository {
  private readonly seen = new Map<string, string>();
  private readonly events: Array<SaveEventInput & { id: string }> = [];

  async saveEvent(input: SaveEventInput): Promise<SaveEventResult> {
    const key = this.buildKey(input);

    const existing = this.seen.get(key);
    if (existing) {
      return { created: false, id: existing };
    }

    const id = randomUUID();
    this.seen.set(key, id);
    this.events.push({ ...input, id });
    return { created: true, id };
  }

  /** Util pra inspeção em testes / health endpoint */
  snapshot(): ReadonlyArray<SaveEventInput & { id: string }> {
    return this.events;
  }

  clear(): void {
    this.seen.clear();
    this.events.length = 0;
  }

  private buildKey(input: SaveEventInput): string {
    const { provider, instanceId, event } = input;
    return `${provider}:${instanceId}:${event.data.providerMessageId}`;
  }
}
