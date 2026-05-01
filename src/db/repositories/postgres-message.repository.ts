import type { Sql } from 'postgres';
import type {
  MessageRepository,
  SaveEventInput,
  SaveEventResult,
} from '../../core/repositories/message-repository.js';
import type {
  NormalizedMessage,
  NormalizedStatusUpdate,
} from '../../core/types/message.js';

/**
 * Persistência idempotente em Postgres.
 *
 * Idempotência: ON CONFLICT (provider, instance_id, provider_message_id, kind)
 * — segunda entrega do mesmo evento NÃO duplica e retorna { created: false }.
 *
 * JSONB: usamos toJsonValue() pra normalizar Date → ISO string e remover
 * propriedades undefined, garantindo compatibilidade com o tipo JSONValue
 * exigido por sql.json().
 */
export class PostgresMessageRepository implements MessageRepository {
  constructor(private readonly sql: Sql) {}

  async saveEvent(input: SaveEventInput): Promise<SaveEventResult> {
    const { provider, instanceId, event, rawPayload } = input;

    const row: Record<string, unknown> = {
      provider,
      instance_id: instanceId,
      provider_message_id: event.data.providerMessageId,
      kind: event.kind,
      event_timestamp: event.data.timestamp,
      normalized: this.sql.json(toJsonValue(event.data)),
      raw_payload:
        rawPayload === undefined || rawPayload === null
          ? null
          : this.sql.json(toJsonValue(rawPayload)),
      ...(event.kind === 'message'
        ? this.messageColumns(event.data)
        : this.statusColumns(event.data)),
    };

    const inserted = await this.sql<{ id: string }[]>`
      INSERT INTO message_events ${this.sql(row)}
      ON CONFLICT (provider, instance_id, provider_message_id, kind) DO NOTHING
      RETURNING id
    `;

    if (inserted.length > 0) {
      return { created: true, id: inserted[0]!.id };
    }

    const [existing] = await this.sql<{ id: string }[]>`
      SELECT id FROM message_events
      WHERE provider = ${provider}
        AND instance_id = ${instanceId}
        AND provider_message_id = ${event.data.providerMessageId}
        AND kind = ${event.kind}
      LIMIT 1
    `;
    return { created: false, id: existing!.id };
  }

  private messageColumns(m: NormalizedMessage): Record<string, unknown> {
    return {
      direction: m.direction,
      message_type: m.type,
      from_phone: m.from.phone,
      from_name: m.from.name ?? null,
      to_phone: m.to.phone,
      to_name: m.to.name ?? null,
      text_content: m.text ?? null,
      reply_to_message_id: m.replyToMessageId ?? null,
      status: null,
      error_reason: null,
    };
  }

  private statusColumns(s: NormalizedStatusUpdate): Record<string, unknown> {
    return {
      direction: null,
      message_type: null,
      from_phone: null,
      from_name: null,
      to_phone: null,
      to_name: null,
      text_content: null,
      reply_to_message_id: null,
      status: s.status,
      error_reason: s.errorReason ?? null,
    };
  }
}

/**
 * Serializa pra JSON puro: Date → ISO, undefined removido,
 * resultado compatível com o tipo JSONValue da lib `postgres`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJsonValue(v: unknown): any {
  return JSON.parse(JSON.stringify(v));
}
