import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { httpErrorHandler } from './errors/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhooks.js';
import type { MessageRepository } from '../core/repositories/message-repository.js';
import type { ProviderRegistry } from '../core/registry/provider-registry.js';
import type { IntentService } from '../core/services/intent.service.js';

export interface BuildServerDeps {
  registry: ProviderRegistry;
  repository: MessageRepository;
  intentService?: IntentService;
  logger?: boolean | object;
}

export function buildServer(deps: BuildServerDeps): FastifyInstance {
  const app = Fastify({
    logger:
      deps.logger ??
      {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    bodyLimit: 1024 * 1024, // 1MB
  });

  app.register(sensible);

  // 🔑 Preserva rawBody pra verificação de assinatura HMAC (Meta, Z-API)
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => {
      const raw = body as string;
      (req as unknown as { rawBody: string }).rawBody = raw;
      try {
        done(null, raw.length ? JSON.parse(raw) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.setErrorHandler(httpErrorHandler);

  app.register(healthRoutes({ registry: deps.registry }));
  app.register(
    webhookRoutes({
      registry: deps.registry,
      repository: deps.repository,
      intentService: deps.intentService,
    }),
  );

  return app;
}
