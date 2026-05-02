import 'dotenv/config';
import { ProviderRegistry } from './core/registry/provider-registry.js';
import { InMemoryMessageRepository } from './db/repositories/in-memory-message.repository.js';
import { PostgresMessageRepository } from './db/repositories/postgres-message.repository.js';
import { InMemoryIntentRepository } from './db/repositories/in-memory-intent.repository.js';
import { PostgresIntentRepository } from './db/repositories/postgres-intent.repository.js';
import { closeDb, getDb } from './db/connection.js';
import { buildServer } from './http/server.js';
import { IntentService } from './core/services/intent.service.js';
import { createIntentClassifier } from './adapters/intent/factory.js';
import type { MessageRepository } from './core/repositories/message-repository.js';
import type { IntentRepository } from './core/repositories/intent-repository.js';

// Providers
import { MetaProvider } from './adapters/meta/meta.provider.js';
import { EvolutionProvider } from './adapters/evolution-baileys/evolution-baileys.provider.js';
import { EvolutionGoProvider } from './adapters/evolution-go/evolution-go.provider.js';
import { WppConnectProvider } from './adapters/wppconnect/wppconnect.provider.js';
import { ZapiProvider } from './adapters/zapi/zapi.provider.js';

interface RepoBundle {
  message: MessageRepository;
  intent: IntentRepository;
  kind: 'postgres' | 'in-memory';
}

function buildRepositories(): RepoBundle {
  if (process.env.DATABASE_URL) {
    const sql = getDb();
    return {
      message: new PostgresMessageRepository(sql),
      intent: new PostgresIntentRepository(sql),
      kind: 'postgres',
    };
  }
  return {
    message: new InMemoryMessageRepository(),
    intent: new InMemoryIntentRepository(),
    kind: 'in-memory',
  };
}

function buildRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  const env = process.env;

  // ───── Meta (Cloud API oficial) ─────
  if (env.META_APP_SECRET && env.META_VERIFY_TOKEN) {
    registry.register(
      env.META_INSTANCE_ID ?? 'default',
      new MetaProvider({
        accessToken: env.META_ACCESS_TOKEN ?? '',
        phoneNumberId: env.META_PHONE_NUMBER_ID ?? '',
        appSecret: env.META_APP_SECRET,
        verifyToken: env.META_VERIFY_TOKEN,
      }),
    );
  }

  // ───── Evolution (Baileys / Node) ─────
  if (env.EVOLUTION_BAILEYS_BASE_URL && env.EVOLUTION_BAILEYS_API_KEY) {
    registry.register(
      env.EVOLUTION_BAILEYS_INSTANCE ?? 'default',
      new EvolutionProvider({
        baseUrl: env.EVOLUTION_BAILEYS_BASE_URL,
        instance: env.EVOLUTION_BAILEYS_INSTANCE ?? 'default',
        apiKey: env.EVOLUTION_BAILEYS_API_KEY,
        webhookApiKey: env.EVOLUTION_BAILEYS_WEBHOOK_API_KEY,
      }),
    );
  }

  // ───── Evolution Go ─────
  if (env.EVOLUTION_GO_BASE_URL && env.EVOLUTION_GO_API_KEY) {
    registry.register(
      env.EVOLUTION_GO_INSTANCE ?? 'default',
      new EvolutionGoProvider({
        baseUrl: env.EVOLUTION_GO_BASE_URL,
        instance: env.EVOLUTION_GO_INSTANCE ?? 'default',
        apiKey: env.EVOLUTION_GO_API_KEY,
        webhookApiKey: env.EVOLUTION_GO_WEBHOOK_API_KEY,
      }),
    );
  }

  // ───── WPPConnect ─────
  if (env.WPPCONNECT_BASE_URL && env.WPPCONNECT_TOKEN) {
    registry.register(
      env.WPPCONNECT_SESSION ?? 'default',
      new WppConnectProvider({
        baseUrl: env.WPPCONNECT_BASE_URL,
        session: env.WPPCONNECT_SESSION ?? 'default',
        token: env.WPPCONNECT_TOKEN,
        webhookSecret: env.WPPCONNECT_WEBHOOK_SECRET,
      }),
    );
  }

  // ───── Z-API ─────
  if (env.ZAPI_INSTANCE_ID && env.ZAPI_INSTANCE_TOKEN && env.ZAPI_CLIENT_TOKEN) {
    registry.register(
      env.ZAPI_INSTANCE_ID,
      new ZapiProvider({
        instanceId: env.ZAPI_INSTANCE_ID,
        instanceToken: env.ZAPI_INSTANCE_TOKEN,
        clientToken: env.ZAPI_CLIENT_TOKEN,
        webhookClientToken: env.ZAPI_WEBHOOK_CLIENT_TOKEN,
      }),
    );
  }

  return registry;
}

async function main(): Promise<void> {
  const registry = buildRegistry();
  const repos = buildRepositories();

  // Intent classification (sempre ligado; mock por default se sem env)
  const classifier = createIntentClassifier(process.env);
  const intentService = new IntentService(classifier, repos.intent);

  const app = buildServer({
    registry,
    repository: repos.message,
    intentService,
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port, host });
  app.log.info(
    {
      repository: repos.kind,
      providers: registry.list(),
      intentClassifier: classifier.providerName,
    },
    `🚀 SuperSDR HTTP listening on http://${host}:${port}`,
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down...');
    await app.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
