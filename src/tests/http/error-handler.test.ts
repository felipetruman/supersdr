import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import {
  ProviderApiError,
  ProviderNotFoundError,
  UnsupportedFeatureError,
  WebhookSignatureError,
  WebhookValidationError,
} from '../../core/errors/provider-error.js';
import { httpErrorHandler } from '../../http/errors/error-handler.js';

interface TestReply {
  code: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

interface TestRequest {
  log: {
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
}

function makeRequest(): TestRequest {
  return { log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } };
}

function makeReply(): TestReply {
  const reply = {} as TestReply;
  reply.code = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn();
  return reply;
}

describe('httpErrorHandler', () => {
  it('handles provider-specific errors', () => {
    const request = makeRequest();
    const reply = makeReply();

    httpErrorHandler(new WebhookSignatureError('meta'), request as never, reply as never);
    httpErrorHandler(
      new WebhookValidationError('meta', { bad: true }),
      request as never,
      reply as never,
    );
    httpErrorHandler(new ProviderNotFoundError('meta', 'x'), request as never, reply as never);
    httpErrorHandler(new UnsupportedFeatureError('meta', 'send'), request as never, reply as never);
    httpErrorHandler(
      new ProviderApiError('meta', 503, 'upstream', { x: 1 }),
      request as never,
      reply as never,
    );

    expect(reply.code).toHaveBeenCalledWith(502);
    expect(request.log.warn).toHaveBeenCalled();
    expect(request.log.info).toHaveBeenCalled();
    expect(request.log.error).toHaveBeenCalled();
  });

  it('handles zod, fastify and fallback errors', () => {
    const request = makeRequest();
    const reply = makeReply();

    httpErrorHandler(new ZodError([]), request as never, reply as never);
    httpErrorHandler(
      Object.assign(new Error('bad'), { statusCode: 400, code: 'BAD_REQUEST' }),
      request as never,
      reply as never,
    );
    httpErrorHandler(new Error('boom'), request as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalled();
  });
});
