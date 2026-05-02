import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../../core/registry/provider-registry.js';
import { InMemoryMessageRepository } from '../../db/repositories/in-memory-message.repository.js';
import { buildServer } from '../../http/server.js';
import type { Sql } from 'postgres';

describe('GET /health', () => {
  let registry: ProviderRegistry;
  let repository: InMemoryMessageRepository;

  beforeEach(() => {
    registry = new ProviderRegistry();
    repository = new InMemoryMessageRepository();
  });

  it('returns 200 with status, uptime and timestamp', async () => {
    const app = buildServer({ registry, repository, logger: false });
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });
});

describe('GET /health/providers', () => {
  it('returns the list of registered providers', async () => {
    const registry = new ProviderRegistry();
    registry.register('default', {
      name: 'meta',
      verifyWebhook: () => {},
      parseWebhook: () => [],
      sendMessage: async () => ({
        providerMessageId: 'x',
        acceptedAt: new Date(),
        raw: {},
      }),
    });
    const app = buildServer({
      registry,
      repository: new InMemoryMessageRepository(),
      logger: false,
    });
    const res = await app.inject({ method: 'GET', url: '/health/providers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.registered)).toBe(true);
    expect(body.registered).toEqual([{ name: 'meta', instanceId: 'default' }]);
  });
});

describe('GET /health/ready', () => {
  it('returns ready=in-memory when no SQL is provided', async () => {
    const app = buildServer({
      registry: new ProviderRegistry(),
      repository: new InMemoryMessageRepository(),
      logger: false,
    });
    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready');
    expect(body.db).toEqual({ kind: 'in-memory' });
  });

  it('returns ready=ok when SQL SELECT 1 succeeds', async () => {
    // Mock mínimo do template-tag `sql` do postgres-js: callable que retorna Promise.
    const fakeSql = (() => Promise.resolve([{ '?column?': 1 }])) as unknown as Sql;
    const app = buildServer({
      registry: new ProviderRegistry(),
      repository: new InMemoryMessageRepository(),
      sql: fakeSql,
      logger: false,
    });
    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json().db).toEqual({ kind: 'ok' });
  });

  it('returns 503 with db.kind=down when SELECT 1 throws', async () => {
    const fakeSql = (() =>
      Promise.reject(new Error('connection refused'))) as unknown as Sql;
    const app = buildServer({
      registry: new ProviderRegistry(),
      repository: new InMemoryMessageRepository(),
      sql: fakeSql,
      logger: false,
    });
    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('unready');
    expect(body.db.kind).toBe('down');
    expect(body.db.error).toBe('connection refused');
  });
});
