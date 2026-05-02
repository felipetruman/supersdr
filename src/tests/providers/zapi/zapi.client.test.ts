import { describe, it, expect, vi } from 'vitest';
import { ZapiClient } from '../../../adapters/zapi/zapi.client.js';
import { ProviderApiError, UnsupportedFeatureError } from '../../../core/errors/provider-error.js';

function makeClient(fetchImpl: typeof fetch) {
  return new ZapiClient({
    baseUrl: 'https://api.z-api.io',
    instanceId: 'INST123',
    instanceToken: 'TOKEN456',
    clientToken: 'CLIENT_TOKEN_789',
    fetchImpl,
  });
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    statusText: 'Bad Request',
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('ZapiClient — sendMessage', () => {
  it('envia texto e retorna SendResult', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse({ messageId: 'zapi-msg-1', zaapId: 'z1' })) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).sendMessage('5547988887777', {
      type: 'text',
      text: 'oi',
    });

    expect(result.providerMessageId).toBe('zapi-msg-1');
    expect(result.acceptedAt).toBeInstanceOf(Date);

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const [url, init] = calls[0] as [string, RequestInit];

    expect(url).toBe(
      'https://api.z-api.io/instances/INST123/token/TOKEN456/send-text',
    );
    expect(init.headers).toMatchObject({
      'Client-Token': 'CLIENT_TOKEN_789',
      'Content-Type': 'application/json',
    });

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ phone: '5547988887777', message: 'oi' });
  });

  it('envia imagem com caption no endpoint correto', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse({ messageId: 'img-1' })) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547988887777', {
      type: 'image',
      url: 'https://cdn.test/img.jpg',
      caption: 'olha',
    });

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const [url, init] = calls[0] as [string, RequestInit];

    expect(url).toBe(
      'https://api.z-api.io/instances/INST123/token/TOKEN456/send-image',
    );
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      phone: '5547988887777',
      image: 'https://cdn.test/img.jpg',
      caption: 'olha',
    });
  });

  it('envia áudio no endpoint send-audio', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse({ messageId: 'aud-1' })) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'audio',
      url: 'https://cdn.test/a.ogg',
    });

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const [url] = calls[0] as [string, RequestInit];
    expect(url).toContain('/send-audio');
  });

  it('envia documento com fileName', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse({ messageId: 'doc-1' })) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'document',
      url: 'https://cdn.test/f.pdf',
      fileName: 'contrato.pdf',
    });

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const [url, init] = calls[0] as [string, RequestInit];
    expect(url).toContain('/send-document');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ fileName: 'contrato.pdf' });
  });

  it('lança ProviderApiError em resposta não-ok', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(errResponse(400, { error: 'invalid phone' })) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('badphone', {
        type: 'text',
        text: 'x',
      }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });

  it('preserva status code no ProviderApiError', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(errResponse(500, { error: 'boom' })) as unknown as typeof fetch;

    try {
      await makeClient(fetchImpl).sendMessage('5547', {
        type: 'text',
        text: 'x',
      });
      throw new Error('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderApiError);
      expect((err as ProviderApiError).httpStatus).toBe(500);
    }
  });

  it('lança ProviderApiError quando resposta não tem messageId', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse({ unexpected: 'shape' })) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', {
        type: 'text',
        text: 'x',
      }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });
});

describe('ZapiClient — exhaustive default', () => {
  it('lança UnsupportedFeatureError para tipo de mensagem inválido', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'invalid-type' } as never),
    ).rejects.toBeInstanceOf(UnsupportedFeatureError);
  });
});
