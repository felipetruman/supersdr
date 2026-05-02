import { describe, it, expect, vi } from 'vitest';
import { EvolutionGoClient } from '../../../adapters/evolution-go/evolution-go.client.js';
import { ProviderApiError, UnsupportedFeatureError } from '../../../core/errors/provider-error.js';

function makeClient(fetchImpl: typeof fetch) {
  return new EvolutionGoClient({
    baseUrl: 'https://evogo.test',
    instance: 'inst-1',
    apiKey: 'key-abc',
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

describe('EvolutionGoClient', () => {
  it('envia texto e retorna SendResult', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'evogo-1' } }),
    ) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'oi',
    });

    expect(result.providerMessageId).toBe('evogo-1');
    expect(result.acceptedAt).toBeInstanceOf(Date);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    // URL não tem instance no path (vai no header)
    expect(url).toBe('https://evogo.test/send/text');
    expect((init as RequestInit).headers).toMatchObject({
      apikey: 'key-abc',
      instance: 'inst-1',
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ number: '5547', text: 'oi' });
  });

  it('envia texto com quoted reply via campo id (não objeto quoted)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'q' } }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'reply',
      replyToMessageId: 'orig-id',
    });

    const body = JSON.parse(
      ((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as RequestInit).body as string,
    );
    // Evolution Go usa `id` raiz, não objeto `quoted`
    expect(body.id).toBe('orig-id');
    expect(body.quoted).toBeUndefined();
  });

  it.each(['image', 'video'] as const)(
    'envia mídia %s no endpoint /send/media com campo url',
    async (type) => {
      const fetchImpl = vi.fn().mockResolvedValue(
        okResponse({ key: { id: 'm' } }),
      ) as unknown as typeof fetch;

      await makeClient(fetchImpl).sendMessage('5547', {
        type,
        url: 'https://x/file',
        caption: 'cap',
      } as never);

      const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect(url).toBe('https://evogo.test/send/media');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.mediatype).toBe(type);
      expect(body.url).toBe('https://x/file');
      expect(body.caption).toBe('cap');
    },
  );

  it('envia document com fileName', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'd' } }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'document',
      url: 'https://x/f.pdf',
      fileName: 'f.pdf',
    });

    const body = JSON.parse(
      ((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as RequestInit).body as string,
    );
    expect(body.fileName).toBe('f.pdf');
    expect(body.mediatype).toBe('document');
  });

  it('envia áudio no endpoint /send/audio', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'a' } }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'audio',
      url: 'https://x/a.ogg',
    });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe('https://evogo.test/send/audio');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.url).toBe('https://x/a.ogg');
  });

  it('envia location no endpoint /send/location', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'l' } }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'location',
      latitude: -26.9,
      longitude: -49.0,
      name: 'BNU',
      address: 'SC',
    });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe('https://evogo.test/send/location');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.latitude).toBe(-26.9);
    expect(body.name).toBe('BNU');
  });

  it('lança ProviderApiError em resposta não-ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      errResponse(401, { error: 'unauthorized' }),
    ) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });

  it('ProviderApiError carrega provider correto (evolution-go)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      errResponse(500, { error: 'boom' }),
    ) as unknown as typeof fetch;

    try {
      await makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' });
      expect.fail('deveria ter lançado');
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderApiError);
      expect((e as ProviderApiError).provider).toBe('evolution-go');
    }
  });

  it('lança ProviderApiError quando response não tem key.id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ status: 'ok' }),
    ) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toThrowError(/missing key\.id/);
  });

  it('lida com body vazio na resposta', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'ISE',
      text: async () => '',
    } as unknown as Response) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });

  it('lida com body não-JSON na resposta', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => '<html>oops</html>',
    } as unknown as Response) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });
});

describe('EvolutionGoClient — exhaustive default', () => {
  it('lança UnsupportedFeatureError para tipo de mensagem inválido', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'invalid-type' } as never),
    ).rejects.toBeInstanceOf(UnsupportedFeatureError);
  });
});
