import {
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Tabela única para eventos brutos + normalizados, com discriminator `kind`.
 * As migrations canônicas continuam sendo SQL puro em src/db/migrations/.
 * Este schema existe para:
 *   - Drizzle Studio (db:studio)
 *   - Queries type-safe quando alguém quiser usar drizzle-orm
 *   - drizzle-kit pull/check contra o banco
 *
 * Idempotência: UNIQUE (provider, instance_id, provider_message_id, kind)
 */
export const messageEvents = pgTable(
  'message_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    instanceId: text('instance_id').notNull(),
    providerMessageId: text('provider_message_id').notNull(),
    kind: text('kind').notNull(),

    // kind = 'message'
    direction: text('direction'),
    messageType: text('message_type'),
    fromPhone: text('from_phone'),
    fromName: text('from_name'),
    toPhone: text('to_phone'),
    toName: text('to_name'),
    textContent: text('text_content'),
    replyToMessageId: text('reply_to_message_id'),

    // kind = 'status'
    status: text('status'),
    errorReason: text('error_reason'),

    // Comum
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(),
    normalized: jsonb('normalized').notNull(),
    rawPayload: jsonb('raw_payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Classificação de intenção (LLM)
    intent: text('intent'),
    intentConfidence: numeric('intent_confidence', { precision: 4, scale: 3 }),
    intentProvider: text('intent_provider'),
    intentModel: text('intent_model'),
    intentClassifiedAt: timestamp('intent_classified_at', { withTimezone: true }),
  },
  (t) => ({
    uniqueEvent: uniqueIndex('message_events_unique').on(
      t.provider,
      t.instanceId,
      t.providerMessageId,
      t.kind,
    ),
    byProviderInstance: index('idx_message_events_provider_instance').on(
      t.provider,
      t.instanceId,
      t.eventTimestamp,
    ),
    byFromPhone: index('idx_message_events_from_phone').on(t.fromPhone),
    byCreatedAt: index('idx_message_events_created_at').on(t.createdAt),
    byIntent: index('idx_message_events_intent').on(t.intent),
    kindCheck: check('message_events_kind_check', sql`${t.kind} IN ('message', 'status')`),
    intentConfidenceCheck: check(
      'message_events_intent_confidence_range',
      sql`${t.intentConfidence} IS NULL OR (${t.intentConfidence} >= 0 AND ${t.intentConfidence} <= 1)`,
    ),
  }),
);

/** Metadata de migrations aplicadas (gerenciado por src/db/migrate.ts). */
export const _migrations = pgTable('_migrations', {
  name: text('name').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MessageEventRow = typeof messageEvents.$inferSelect;
export type NewMessageEventRow = typeof messageEvents.$inferInsert;
