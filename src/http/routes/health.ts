import type { FastifyPluginAsync } from 'fastify';
import type { Sql } from 'postgres';
import type { ProviderRegistry } from '../../core/registry/provider-registry.js';

interface Deps {
  registry: ProviderRegistry;
  /** Opcional: quando presente, /health verifica conectividade com SELECT 1. */
  sql?: Sql;
}

type DbHealth = { kind: 'in-memory' } | { kind: 'ok' } | { kind: 'down'; error: string };

async function checkDb(sql: Sql | undefined): Promise<DbHealth> {
  if (!sql) return { kind: 'in-memory' };
  try {
    await sql`SELECT 1`;
    return { kind: 'ok' };
  } catch (err) {
    return { kind: 'down', error: (err as Error).message };
  }
}

export const healthRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app) => {
    /** Liveness — processo está vivo (não checa dependências). */
    app.get('/health', async () => ({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));

    /** Readiness — checa dependências críticas (DB). 503 se DB caído. */
    app.get('/health/ready', async (_req, reply) => {
      const db = await checkDb(deps.sql);
      const ready = db.kind !== 'down';
      return reply.code(ready ? 200 : 503).send({
        status: ready ? 'ready' : 'unready',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        db,
      });
    });

    app.get('/health/providers', async () => ({
      registered: deps.registry.list(),
    }));
  };
