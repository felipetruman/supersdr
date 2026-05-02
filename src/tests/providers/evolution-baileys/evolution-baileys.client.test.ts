import { describe, it, expect, vi } from 'vitest';
import { EvolutionClient } from '../../../adapters/evolution-baileys/evolution-baileys.client.js';
import { ProviderApiError, UnsupportedFeatureError } from '../../../core/errors/provider-error.js';

function makeClient(fetchImpl: typeof fetch) {
  return new EvolutionClient({
    baseUrl: 'https://evo.test',
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

describe('EvolutionClient', () => {
  it('envia texto e retorna SendResult', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'evo-1' } }),
    ) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'oi',
    });

    expect(result.providerMessageId).toBe('evo-1');
    expect(result.acceptedAt).toBeInstanceOf(Date);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe('https://evo.test/message/sendText/inst-1');
    expect((init as RequestInit).headers).toMatchObject({ apikey: 'key-abc' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ number: '5547', text: 'oi' });
  });

  it('envia texto com quoted quando replyToMessageId presente', async () => {
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
    expect(body.quoted).toEqual({ key: { id: 'orig-id' } });
  });

  it.each(['image', 'video'] as const)(
    'envia mídia %s no endpoint sendMedia',
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
      expect(url).toBe('https://evo.test/message/sendMedia/inst-1');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.mediatype).toBe(type);
      expect(body.media).toBe('https://x/file');
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
  });

  it('envia áudio no endpoint sendWhatsAppAudio', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ key: { id: 'a' } }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'audio',
      url: 'https://x/a.ogg',
    });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe('https://evo.test/message/sendWhatsAppAudio/inst-1');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.audio).toBe('https://x/a.ogg');
  });

  it('envia location', async () => {
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
    expect(url).toBe('https://evo.test/message/sendLocation/inst-1');
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

describe('EvolutionClient — exhaustive default', () => {
  it('lança UnsupportedFeatureError para tipo de mensagem inválido', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'invalid-type' } as never),
    ).rejects.toBeInstanceOf(UnsupportedFeatureError);
  });
});
