import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { MessageRepository } from '../../core/repositories/message-repository.js';
import type { ProviderRegistry } from '../../core/registry/provider-registry.js';
import type { IntentService } from '../../core/services/intent.service.js';
import type { ProviderName } from '../../core/types/message.js';

interface WebhookParams {
  provider: ProviderName;
  instanceId: string;
}

interface WebhookQuery {
  [key: string]: string | undefined;
}

interface Deps {
  registry: ProviderRegistry;
  repository: MessageRepository;
  /** Opcional: se ausente, classificação fica desligada (graceful degradation) */
  intentService?: IntentService;
}

export const webhookRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app: FastifyInstance) => {
    /**
     * GET — Verificação inicial (challenge da Meta).
     * Outros providers retornam 200 vazio (idempotente).
     */
    app.get<{ Params: WebhookParams; Querystring: WebhookQuery }>(
      '/webhooks/:provider/:instanceId',
      async (request, reply) => {
        const { provider, instanceId } = request.params;
        const adapter = deps.registry.get(provider, instanceId);

        if (adapter.handleVerification) {
          const challenge = adapter.handleVerification({
            headers: request.headers,
            rawBody: '',
            body: undefined,
            query: request.query,
          });
          if (challenge) {
            return reply.code(200).type('text/plain').send(challenge);
          }
          return reply.code(403).send({ error: 'verification_failed' });
        }

        return reply.code(200).send({ status: 'ok' });
      },
    );

    /**
     * POST — Recebe webhook real.
     * Fluxo: verifyWebhook → parseWebhook → saveEvent (idempotente) → classify (bg) → 200.
     * ACK rápido (<5s exigido pela Meta). Classificação é fire-and-forget.
     */
    app.post<{ Params: WebhookParams; Querystring: WebhookQuery; Body: unknown }>(
      '/webhooks/:provider/:instanceId',
      async (request, reply) => {
        const { provider, instanceId } = request.params;

        // 1) Resolve provider (lança ProviderNotFoundError → 404)
        const adapter = deps.registry.get(provider, instanceId);

        const webhookReq = {
          headers: request.headers,
          rawBody: request.rawBody ?? '',
          body: request.body,
          query: request.query,
        };

        // 2) Verifica assinatura (lança WebhookSignatureError → 401)
        adapter.verifyWebhook(webhookReq);

        // 3) Normaliza (lança WebhookValidationError → 400)
        const events = adapter.parseWebhook(webhookReq);

        // 4) Persiste idempotente
        const persisted = await Promise.all(
          events.map((event) =>
            deps.repository.saveEvent({
              provider,
              instanceId,
              event,
              rawPayload: request.body,
            }),
          ),
        );

        // 5) Classifica em background (não bloqueia ACK)
        //    Critério: novo (created), tipo message, com texto não-vazio.
        if (deps.intentService) {
          events.forEach((event, i) => {
            const r = persisted[i]!;
            if (
              r.created &&
              event.kind === 'message' &&
              typeof event.data.text === 'string' &&
              event.data.text.trim().length > 0
            ) {
              deps.intentService!.classifyInBackground(r.id, event.data.text);
            }
          });
        }

        return reply.code(200).send({
          received: events.length,
          persisted: persisted.filter((p) => p.created).length,
          deduped: persisted.filter((p) => !p.created).length,
        });
      },
    );
  };
