import { describe, it, expect, vi } from 'vitest';
import { MetaClient } from '../../../adapters/meta/meta.client.js';
import { ProviderApiError, UnsupportedFeatureError } from '../../../core/errors/provider-error.js';

function makeClient(fetchImpl: typeof fetch) {
  return new MetaClient({
    phoneNumberId: '123',
    accessToken: 'token',
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

describe('MetaClient', () => {
  it('envia mensagem de texto e retorna providerMessageId', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({
        messaging_product: 'whatsapp',
        contacts: [{ input: '5547', wa_id: '5547' }],
        messages: [{ id: 'wamid.TXT' }],
      }),
    ) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'oi',
    });

    expect(result.providerMessageId).toBe('wamid.TXT');
    expect(result.acceptedAt).toBeInstanceOf(Date);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toContain('/v21.0/123/messages');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.type).toBe('text');
    expect(body.text.body).toBe('oi');
  });

  it('inclui context quando replyToMessageId presente', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ messages: [{ id: 'x' }] }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'reply',
      replyToMessageId: 'wamid.ORIG',
    });

    const body = JSON.parse(
      ((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as RequestInit).body as string,
    );
    expect(body.context).toEqual({ message_id: 'wamid.ORIG' });
  });

  it.each(['image', 'audio', 'video'] as const)(
    'envia mídia tipo %s com link e caption',
    async (type) => {
      const fetchImpl = vi.fn().mockResolvedValue(
        okResponse({ messages: [{ id: 'm-' + type }] }),
      ) as unknown as typeof fetch;

      await makeClient(fetchImpl).sendMessage('5547', {
        type,
        url: 'https://x/file',
        caption: 'legenda',
      } as never);

      const body = JSON.parse(
        ((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
          .calls[0][1] as RequestInit).body as string,
      );
      expect(body.type).toBe(type);
      expect(body[type].link).toBe('https://x/file');
      expect(body[type].caption).toBe('legenda');
    },
  );

  it('envia document com filename', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ messages: [{ id: 'doc' }] }),
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
    expect(body.document.filename).toBe('f.pdf');
  });

  it('envia location', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ messages: [{ id: 'loc' }] }),
    ) as unknown as typeof fetch;

    await makeClient(fetchImpl).sendMessage('5547', {
      type: 'location',
      latitude: -26.9,
      longitude: -49.0,
      name: 'Blumenau',
      address: 'SC',
    });

    const body = JSON.parse(
      ((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as RequestInit).body as string,
    );
    expect(body.type).toBe('location');
    expect(body.location.latitude).toBe(-26.9);
    expect(body.location.name).toBe('Blumenau');
  });

  it('lança ProviderApiError quando resposta não-ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      errResponse(400, { error: { message: 'bad' } }),
    ) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });

  it('lança ProviderApiError quando response não tem messages[0].id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ messaging_product: 'whatsapp', messages: [] }),
    ) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toThrowError(/missing message id/);
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

  it('respeita baseUrl e graphApiVersion customizados', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ messages: [{ id: 'v' }] }),
    ) as unknown as typeof fetch;

    const client = new MetaClient({
      phoneNumberId: '999',
      accessToken: 't',
      baseUrl: 'https://custom.api',
      graphApiVersion: 'v20.0',
      fetchImpl,
    });
    await client.sendMessage('5547', { type: 'text', text: 'x' });

    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(url).toBe('https://custom.api/v20.0/999/messages');
  });
});

describe('MetaClient — exhaustive default', () => {
  it('lança UnsupportedFeatureError para tipo de mensagem inválido', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'invalid-type' } as never),
    ).rejects.toBeInstanceOf(UnsupportedFeatureError);
  });
});
