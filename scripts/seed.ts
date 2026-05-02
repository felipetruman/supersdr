/**
 * Seed script — popula message_events com 2 eventos de exemplo (1 mensagem + 1 status).
 *
 * Uso:
 *   pnpm db:seed
 *
 * Pré-requisito: DATABASE_URL configurada e migrations aplicadas (pnpm db:migrate).
 */
import 'dotenv/config';
import { closeDb, getDb } from '../src/db/connection.js';
import { PostgresMessageRepository } from '../src/db/repositories/postgres-message.repository.js';
import type { NormalizedEvent } from '../src/core/types/message.js';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set — abortando seed.');
    process.exit(1);
  }

  const sql = getDb();
  const repo = new PostgresMessageRepository(sql);

  const now = new Date();

  const sampleMessage: NormalizedEvent = {
    kind: 'message',
    data: {
      providerMessageId: 'seed-msg-001',
      provider: 'meta',
      providerInstanceId: 'default',
      direction: 'inbound',
      type: 'text',
      from: { phone: '5511988888888', name: 'João Silva (seed)' },
      to: { phone: '5511999999999', name: 'SuperSDR' },
      text: 'Olá, gostaria de saber mais sobre o produto',
      timestamp: now,
      raw: { source: 'seed', synthetic: true },
    },
  };

  const sampleStatus: NormalizedEvent = {
    kind: 'status',
    data: {
      providerMessageId: 'seed-msg-001',
      provider: 'meta',
      providerInstanceId: 'default',
      status: 'delivered',
      timestamp: now,
      raw: { source: 'seed', synthetic: true },
    },
  };

  const results = await Promise.all([
    repo.saveEvent({
      provider: 'meta',
      instanceId: 'default',
      event: sampleMessage,
      rawPayload: sampleMessage.data.raw,
    }),
    repo.saveEvent({
      provider: 'meta',
      instanceId: 'default',
      event: sampleStatus,
      rawPayload: sampleStatus.data.raw,
    }),
  ]);

  const summary = results.map((r, i) => ({
    event: i === 0 ? 'message' : 'status',
    created: r.created,
    id: r.id,
  }));

  console.log('Seed concluído:');
  console.table(summary);

  await closeDb();
}

main().catch(async (err) => {
  console.error('Seed falhou:', err);
  await closeDb().catch(() => {});
  process.exit(1);
});
