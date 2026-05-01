import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  ProviderApiError,
  ProviderNotFoundError,
  UnsupportedFeatureError,
  WebhookSignatureError,
  WebhookValidationError,
} from '../../core/errors/provider-error.js';

interface HttpErrorBody {
  error: {
    code: string;
    message: string;
    provider?: string;
    details?: unknown;
  };
}

/**
 * Mapeia erros tipados do domínio para respostas HTTP coerentes.
 * Mantém o core agnóstico de HTTP — só esta camada conhece status codes.
 */
export function httpErrorHandler(
  err: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // 1) Assinatura inválida → 401 (não logar payload sensível)
  if (err instanceof WebhookSignatureError) {
    request.log.warn(
      { provider: err.provider, code: err.code },
      'webhook signature rejected',
    );
    reply
      .code(401)
      .send(toBody('WEBHOOK_SIGNATURE_INVALID', err.message, err.provider));
    return;
  }

  // 2) Payload malformado → 400
  if (err instanceof WebhookValidationError) {
    request.log.info(
      { provider: err.provider, cause: err.cause },
      'webhook payload invalid',
    );
    reply
      .code(400)
      .send(
        toBody('WEBHOOK_PAYLOAD_INVALID', err.message, err.provider, err.cause),
      );
    return;
  }

  // 3) Zod cru (defesa em profundidade)
  if (err instanceof ZodError) {
    reply.code(400).send(
      toBody('VALIDATION_ERROR', 'Invalid payload', undefined, err.flatten()),
    );
    return;
  }

  // 4) Provider desconhecido → 404
  if (err instanceof ProviderNotFoundError) {
    reply
      .code(404)
      .send(toBody('PROVIDER_NOT_FOUND', err.message, err.provider));
    return;
  }

  // 5) Feature não suportada → 422
  if (err instanceof UnsupportedFeatureError) {
    reply
      .code(422)
      .send(toBody('UNSUPPORTED_FEATURE', err.message, err.provider));
    return;
  }

  // 6) Falha conversando com a API do provider → 502
  if (err instanceof ProviderApiError) {
    request.log.error(
      { provider: err.provider, upstreamStatus: err.httpStatus, err },
      'provider upstream error',
    );
    reply
      .code(502)
      .send(
        toBody('PROVIDER_UPSTREAM_ERROR', err.message, err.provider, {
          upstreamStatus: err.httpStatus,
        }),
      );
    return;
  }

  // 7) Erros do próprio Fastify (4xx)
  const fastifyErr = err as FastifyError;
  if (fastifyErr.statusCode && fastifyErr.statusCode < 500) {
    reply
      .code(fastifyErr.statusCode)
      .send(toBody(fastifyErr.code ?? 'BAD_REQUEST', fastifyErr.message));
    return;
  }

  // 8) Fallback genérico → 500 (não vaza stack)
  request.log.error({ err }, 'unhandled error');
  reply.code(500).send(toBody('INTERNAL_ERROR', 'Internal server error'));
}

function toBody(
  code: string,
  message: string,
  provider?: string,
  details?: unknown,
): HttpErrorBody {
  return {
    error: {
      code,
      message,
      ...(provider !== undefined && { provider }),
      ...(details !== undefined && { details }),
    },
  };
}
