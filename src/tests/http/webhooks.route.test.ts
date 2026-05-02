import { describe, it, expect, beforeEach } from 'vitest';
import {
  WebhookSignatureError,
  WebhookValidationError,
} from '../../core/errors/provider-error.js';
import type {
  WebhookRequest,
  WhatsAppProvider,
} from '../../core/providers/provider.interface.js';
import { ProviderRegistry } from '../../core/registry/provider-registry.js';
import type { NormalizedEvent } from '../../core/types/message.js';
import { InMemoryMessageRepository } from '../../db/repositories/in-memory-message.repository.js';
import { buildServer } from '../../http/server.js';

function makeFakeProvider(
  overrides: Partial<WhatsAppProvider> = {},
): WhatsAppProvider {
  const fakeEvent: NormalizedEvent = {
    kind: 'message',
    data: {
      providerMessageId: 'fake-msg-1',
      provider: 'meta',
      providerInstanceId: 'default',
      direction: 'inbound',
      type: 'text',
      from: { phone: '5547999999999', name: 'Tester' },
      to: { phone: '5547888888888' },
      text: 'hello',
      timestamp: new Date('2024-01-15T10:30:00Z'),
      raw: {},
    },
  };

  return {
    name: 'meta',
    verifyWebhook: () => {},
    parseWebhook: (_req: WebhookRequest) => [fakeEvent],
    sendMessage: async () => ({
      providerMessageId: 'x',
      acceptedAt: new Date(),
      raw: {},
    }),
    ...overrides,
  };
}

describe('POST /webhooks/:provider/:instanceId', () => {
  let registry: ProviderRegistry;
  let repository: InMemoryMessageRepository;

  beforeEach(() => {
    registry = new ProviderRegistry();
    repository = new InMemoryMessageRepository();
  });

  it('returns 200 and persists when webhook is valid', async () => {
    registry.register('default', makeFakeProvider());
    const app = buildServer({ registry, repository, logger: false });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/meta/default',
      payload: { hello: 'world' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: 1, persisted: 1, deduped: 0 });
    expect(repository.snapshot()).toHaveLength(1);
  });

  it('deduplicates same providerMessageId on second call', async () => {
    registry.register('default', makeFakeProvider());
    const app = buildServer({ registry, repository, logger: false });

    await app.inject({
      method: 'POST',
      url: '/webhooks/meta/default',
      payload: {},
    });
    const second = await app.inject({
      method: 'POST',
      url: '/webhooks/meta/default',
      payload: {},
    });

    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ received: 1, persisted: 0, deduped: 1 });
    expect(repository.snapshot()).toHaveLength(1);
  });

  it('returns 404 when provider is unknown', async () => {
    const app = buildServer({ registry, repository, logger: false });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/meta/ghost',
      payload: {},
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('PROVIDER_NOT_FOUND');
  });

  it('returns 401 when signature is invalid', async () => {
    registry.register(
      'default',
      makeFakeProvider({
        verifyWebhook: () => {
          throw new WebhookSignatureError('meta');
        },
      }),
    );
    const app = buildServer({ registry, repository, logger: false });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/meta/default',
      payload: {},
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('returns 400 when payload is malformed', async () => {
    registry.register(
      'default',
      makeFakeProvider({
        parseWebhook: () => {
          throw new WebhookValidationError('meta', { issues: ['bad'] });
        },
      }),
    );
    const app = buildServer({ registry, repository, logger: false });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/meta/default',
      payload: { broken: true },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('WEBHOOK_PAYLOAD_INVALID');
  });

  it('GET /health returns ok', async () => {
    const app = buildServer({ registry, repository, logger: false });

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});
