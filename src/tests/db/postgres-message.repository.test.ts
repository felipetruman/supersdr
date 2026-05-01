import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import postgres, { type Sql } from 'postgres';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresMessageRepository } from '../../db/repositories/postgres-message.repository.js';
import type { NormalizedEvent } from '../../core/types/message.js';

const DATABASE_URL = process.env.DATABASE_URL;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Skipa se não tiver Postgres rodando (CI-friendly)
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb('PostgresMessageRepository (integration)', () => {
  let sql: Sql;
  let repo: PostgresMessageRepository;

  beforeAll(async () => {
    sql = postgres(DATABASE_URL!, { max: 2 });
    const migrationPath = join(__dirname, '../../db/migrations/001_init.sql');
    const migration = await readFile(migrationPath, 'utf8');
    await sql.unsafe(migration);
    repo = new PostgresMessageRepository(sql);
  });

  beforeEach(async () => {
    await sql`TRUNCATE TABLE message_events`;
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  const buildMessageEvent = (id = 'msg-1'): NormalizedEvent => ({
    kind: 'message',
    data: {
      providerMessageId: id,
      provider: 'meta',
      providerInstanceId: 'default',
      direction: 'inbound',
      type: 'text',
      from: { phone: '5547999999999', name: 'Test' },
      to: { phone: '5547888888888' },
      text: 'hello',
      timestamp: new Date('2026-05-01T12:00:00Z'),
      raw: {},
    },
  });

  it('inserts a new event and returns created=true', async () => {
    const result = await repo.saveEvent({
      provider: 'meta',
      instanceId: 'default',
      event: buildMessageEvent(),
      rawPayload: { foo: 'bar' },
    });

    expect(result.created).toBe(true);
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('deduplicates same providerMessageId on second save', async () => {
    const event = buildMessageEvent('dup-1');
    const first = await repo.saveEvent({
      provider: 'meta',
      instanceId: 'default',
      event,
      rawPayload: {},
    });
    const second = await repo.saveEvent({
      provider: 'meta',
      instanceId: 'default',
      event,
      rawPayload: {},
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM message_events
    `;
    expect(Number(count)).toBe(1);
  });

  it('allows same providerMessageId across different kinds (message + status)', async () => {
    const messageEvent = buildMessageEvent('mixed-1');
    const statusEvent: NormalizedEvent = {
      kind: 'status',
      data: {
        providerMessageId: 'mixed-1',
        provider: 'meta',
        providerInstanceId: 'default',
        status: 'delivered',
        timestamp: new Date(),
        raw: {},
      },
    };

    const r1 = await repo.saveEvent({
      provider: 'meta',
      instanceId: 'default',
      event: messageEvent,
      rawPayload: {},
    });
    const r2 = await repo.saveEvent({
      provider: 'meta',
      instanceId: 'default',
      event: statusEvent,
      rawPayload: {},
    });

    expect(r1.created).toBe(true);
    expect(r2.created).toBe(true);
    expect(r1.id).not.toBe(r2.id);
  });

  it('isolates events by instanceId', async () => {
    const event = buildMessageEvent('iso-1');
    const a = await repo.saveEvent({
      provider: 'meta',
      instanceId: 'tenant-a',
      event,
      rawPayload: {},
    });
    const b = await repo.saveEvent({
      provider: 'meta',
      instanceId: 'tenant-b',
      event,
      rawPayload: {},
    });

    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(a.id).not.toBe(b.id);
  });
});
