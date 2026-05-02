import { describe, it, expect, vi } from 'vitest';
import { WppClient } from '../../../adapters/wppconnect/wppconnect.client.js';
import { ProviderApiError, UnsupportedFeatureError } from '../../../core/errors/provider-error.js';

function makeClient(fetchImpl: typeof fetch) {
  return new WppClient({
    baseUrl: 'http://wpp.test',
    session: 'sess',
    token: 'tok',
    fetchImpl,
  });
}

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('WppClient — gaps', () => {
  it('lança ProviderApiError quando fetch rejeita (rede)', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    await expect(
      makeClient(fetchImpl).sendMessage('5547', { type: 'text', text: 'x' }),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });

  it('lança UnsupportedFeatureError no exhaustive default (tipo inválido)', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      makeClient(fetchImpl).sendMessage('5547', {
        type: 'invalid-type',
      } as never),
    ).rejects.toBeInstanceOf(UnsupportedFeatureError);
  });

  it('extrai providerMessageId quando id é objeto _serialized', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        ok({ response: { id: { _serialized: 'true_5547@c.us_X' } } }),
      ) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'oi',
    });
    expect(result.providerMessageId).toBe('true_5547@c.us_X');
  });

  it('extrai providerMessageId quando id está no nível raiz', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ id: 'top-level-id' })) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'oi',
    });
    expect(result.providerMessageId).toBe('top-level-id');
  });

  it('retorna providerMessageId vazio quando resposta não tem id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ status: 'success' })) as unknown as typeof fetch;

    const result = await makeClient(fetchImpl).sendMessage('5547', {
      type: 'text',
      text: 'oi',
    });
    expect(result.providerMessageId).toBe('');
  });
});

import { describe as d2, it as i2, expect as e2, vi as v2 } from 'vitest';
import { WppClient as WC } from '../../../adapters/wppconnect/wppconnect.client.js';

const okR = (b: unknown) =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(b),
  }) as unknown as Response;

d2('WppClient — branches finais', () => {
  i2('image sem fileName/caption usa defaults', async () => {
    const f = v2.fn().mockResolvedValue(okR({ id: 'x' })) as unknown as typeof fetch;
    await new WC({ baseUrl: 'http://x', session: 's', token: 't', fetchImpl: f }).sendMessage(
      '5547',
      { type: 'image', url: 'https://x/img' },
    );
    const body = JSON.parse(
      ((f as unknown as ReturnType<typeof v2.fn>).mock.calls[0][1] as RequestInit).body as string,
    );
    e2(body.filename).toBe('image');
    e2(body.caption).toBe('');
  });

  i2('video sem fileName/caption usa defaults', async () => {
    const f = v2.fn().mockResolvedValue(okR({ id: 'x' })) as unknown as typeof fetch;
    await new WC({ baseUrl: 'http://x', session: 's', token: 't', fetchImpl: f }).sendMessage(
      '5547',
      { type: 'video', url: 'https://x/v' },
    );
    const body = JSON.parse(
      ((f as unknown as ReturnType<typeof v2.fn>).mock.calls[0][1] as RequestInit).body as string,
    );
    e2(body.filename).toBe('video');
  });

  i2('location sem name/address usa defaults', async () => {
    const f = v2.fn().mockResolvedValue(okR({ id: 'x' })) as unknown as typeof fetch;
    await new WC({ baseUrl: 'http://x', session: 's', token: 't', fetchImpl: f }).sendMessage(
      '5547',
      { type: 'location', latitude: -26, longitude: -49 },
    );
    const body = JSON.parse(
      ((f as unknown as ReturnType<typeof v2.fn>).mock.calls[0][1] as RequestInit).body as string,
    );
    e2(body.title).toBe('');
    e2(body.address).toBe('');
  });

  i2('phone com 16+ dígitos é tratado como grupo', async () => {
    const f = v2.fn().mockResolvedValue(okR({ id: 'x' })) as unknown as typeof fetch;
    await new WC({ baseUrl: 'http://x', session: 's', token: 't', fetchImpl: f }).sendMessage(
      '1234567890123456',
      { type: 'text', text: 'oi' },
    );
    const body = JSON.parse(
      ((f as unknown as ReturnType<typeof v2.fn>).mock.calls[0][1] as RequestInit).body as string,
    );
    e2(body.isGroup).toBe(true);
  });
});
