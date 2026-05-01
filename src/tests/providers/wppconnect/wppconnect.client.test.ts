import { describe, expect, it, vi } from 'vitest';
import { ProviderApiError } from '../../../core/errors/provider-error.js';
import { WppClient } from '../../../adapters/wppconnect/wppconnect.client.js';

function mockFetch(response: {
  ok?: boolean;
  status?: number;
  body?: unknown;
  throwError?: Error;
}) {
  return vi.fn(async () => {
    if (response.throwError) throw response.throwError;
    const status = response.status ?? 200;
    const ok = response.ok ?? (status >= 200 && status < 300);
    return {
      ok,
      status,
      text: async () =>
        typeof response.body === 'string'
          ? response.body
          : JSON.stringify(response.body ?? {}),
      json: async () =>
        typeof response.body === 'string'
          ? JSON.parse(response.body)
          : response.body ?? {},
    } as Response;
  });
}

function makeClient(fetchImpl: ReturnType<typeof mockFetch>) {
  return new WppClient({
    baseUrl: 'http://localhost:21465',
    session: 'TEST_SESSION',
    token: 'fake-token',
    fetchImpl,
    timeoutMs: 5000,
  });
}

describe('WppClient.sendMessage — text', () => {
  it('faz POST em /send-message com phone limpo e isGroup=false', async () => {
    const fetchImpl = mockFetch({
      body: { status: 'success', response: { id: 'true_5547@c.us_OUT1' } },
    });
    const client = makeClient(fetchImpl);

    const result = await client.sendMessage('+55 (47) 98888-7777', {
      type: 'text',
      text: 'olá',
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:21465/api/TEST_SESSION/send-message');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      'content-type': 'application/json',
      authorization: 'Bearer fake-token',
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      phone: '5547988887777',
      message: 'olá',
      isGroup: false,
    });
    expect(result.providerMessageId).toBe('true_5547@c.us_OUT1');
    expect(result.acceptedAt).toBeInstanceOf(Date);
  });

  it('detecta grupo quando phone tem mais de 15 dígitos', async () => {
    const fetchImpl = mockFetch({ body: { response: { id: 'X' } } });
    const client = makeClient(fetchImpl);

    await client.sendMessage('120363000000000000', { type: 'text', text: 'oi' });

    const body = JSON.parse(
      (fetchImpl.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.isGroup).toBe(true);
  });
});

describe('WppClient.sendMessage — outros tipos', () => {
  it('image → /send-image com path/caption/filename', async () => {
    const fetchImpl = mockFetch({ body: { response: { id: 'IMG' } } });
    await makeClient(fetchImpl).sendMessage('5547988887777', {
      type: 'image',
      url: 'https://cdn/x.jpg',
      caption: 'foto',
      fileName: 'x.jpg',
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/send-image');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      phone: '5547988887777',
      path: 'https://cdn/x.jpg',
      filename: 'x.jpg',
      caption: 'foto',
    });
  });

  it('audio → /send-voice', async () => {
    const fetchImpl = mockFetch({ body: { response: { id: 'AUD' } } });
    await makeClient(fetchImpl).sendMessage('5547988887777', {
      type: 'audio',
      url: 'https://cdn/a.ogg',
    });
    expect(fetchImpl.mock.calls[0][0]).toContain('/send-voice');
  });

  it('document → /send-file com filename default', async () => {
    const fetchImpl = mockFetch({ body: { response: { id: 'DOC' } } });
    await makeClient(fetchImpl).sendMessage('5547988887777', {
      type: 'document',
      url: 'https://cdn/file.pdf',
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/send-file');
    expect(JSON.parse((init as RequestInit).body as string).filename).toBe(
      'document',
    );
  });

  it('location → /send-location com lat/lng como string', async () => {
    const fetchImpl = mockFetch({ body: { response: { id: 'LOC' } } });
    await makeClient(fetchImpl).sendMessage('5547988887777', {
      type: 'location',
      latitude: -26.9194,
      longitude: -49.0661,
      name: 'Blumenau',
    });
    const body = JSON.parse(
      (fetchImpl.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.lat).toBe('-26.9194');
    expect(body.lng).toBe('-49.0661');
    expect(body.title).toBe('Blumenau');
  });
});

describe('WppClient.sendMessage — id _serialized', () => {
  it('extrai providerMessageId de response.id._serialized', async () => {
    const fetchImpl = mockFetch({
      body: { response: { id: { _serialized: 'true_X@c.us_SER' } } },
    });
    const result = await makeClient(fetchImpl).sendMessage('5547988887777', {
      type: 'text',
      text: 'x',
    });
    expect(result.providerMessageId).toBe('true_X@c.us_SER');
  });

  it('retorna string vazia quando id ausente (não quebra)', async () => {
    const fetchImpl = mockFetch({ body: { status: 'success' } });
    const result = await makeClient(fetchImpl).sendMessage('5547988887777', {
      type: 'text',
      text: 'x',
    });
    expect(result.providerMessageId).toBe('');
  });
});

describe('WppClient.sendMessage — erros', () => {
  it('lança ProviderApiError quando HTTP !ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'unauthorized' }),
    } as Response);
    await expect(
      makeClient(fetchImpl).sendMessage('5547988887777', {
        type: 'text',
        text: 'x',
      }),
    ).rejects.toMatchObject({
      name: 'ProviderApiError',
      httpStatus: 401,
      provider: 'wppconnect',
    });
  });

  it('lança ProviderApiError com status=0 quando fetch falha (rede)', async () => {
    const fetchImpl = mockFetch({ throwError: new Error('ECONNREFUSED') });
    await expect(
      makeClient(fetchImpl).sendMessage('5547988887777', {
        type: 'text',
        text: 'x',
      }),
    ).rejects.toMatchObject({
      httpStatus: 0,
      provider: 'wppconnect',
    });
  });

  it('aceita response não-JSON sem quebrar (raw)', async () => {
    const fetchImpl = mockFetch({ body: 'OK string pura' });
    const result = await makeClient(fetchImpl).sendMessage('5547988887777', {
      type: 'text',
      text: 'x',
    });
    expect(result.providerMessageId).toBe('');
    expect(result.raw).toEqual({ raw: 'OK string pura' });
  });
});
