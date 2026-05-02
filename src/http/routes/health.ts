import type { FastifyPluginAsync } from 'fastify';
import type { ProviderRegistry } from '../../core/registry/provider-registry.js';

interface Deps {
  registry: ProviderRegistry;
}

export const healthRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app) => {
    app.get('/health', async () => ({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));

    app.get('/health/providers', async () => ({
      registered: deps.registry.list(),
    }));
  };
