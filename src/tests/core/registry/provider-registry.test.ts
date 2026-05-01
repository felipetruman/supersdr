import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderRegistry } from '../../../core/registry/provider-registry.js';
import type { WhatsAppProvider } from '../../../core/providers/provider.interface.js';
import type { ProviderName } from '../../../core/types/message.js';

function makeProvider(name: ProviderName): WhatsAppProvider {
  return {
    name,
    handleVerification: vi.fn(),
    verifyWebhook: vi.fn(),
    parseWebhook: vi.fn().mockReturnValue([]),
    sendMessage: vi.fn().mockResolvedValue({
      providerMessageId: 'fake-id',
      acceptedAt: new Date(),
      raw: {},
    }),
  } as unknown as WhatsAppProvider;
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('registra e recupera um provider pelo nome + instanceId', () => {
    const provider = makeProvider('meta');
    registry.register('inst-1', provider);

    expect(registry.get('meta', 'inst-1')).toBe(provider);
  });

  it('lança erro ao buscar provider não registrado', () => {
    expect(() => registry.get('meta', 'nope')).toThrowError(
      'Provider not registered: meta:nope',
    );
  });

  it('has() retorna true quando registrado e false caso contrário', () => {
    const provider = makeProvider('evolution-baileys');
    registry.register('inst-2', provider);

    expect(registry.has('evolution-baileys', 'inst-2')).toBe(true);
    expect(registry.has('evolution-baileys', 'inst-x')).toBe(false);
    expect(registry.has('meta', 'inst-2')).toBe(false);
  });

  it('list() retorna todos os providers registrados', () => {
    registry.register('inst-1', makeProvider('meta'));
    registry.register('inst-2', makeProvider('evolution-baileys'));
    registry.register('inst-3', makeProvider('wppconnect'));

    const list = registry.list();
    expect(list).toHaveLength(3);
    expect(list).toEqual(
      expect.arrayContaining([
        { name: 'meta', instanceId: 'inst-1' },
        { name: 'evolution-baileys', instanceId: 'inst-2' },
        { name: 'wppconnect', instanceId: 'inst-3' },
      ]),
    );
  });

  it('list() retorna array vazio quando não há providers', () => {
    expect(registry.list()).toEqual([]);
  });

  it('register() sobrescreve provider com mesma chave', () => {
    const p1 = makeProvider('meta');
    const p2 = makeProvider('meta');
    registry.register('inst-1', p1);
    registry.register('inst-1', p2);

    expect(registry.get('meta', 'inst-1')).toBe(p2);
    expect(registry.list()).toHaveLength(1);
  });

  it('isola providers de mesmo nome em instâncias diferentes', () => {
    const p1 = makeProvider('meta');
    const p2 = makeProvider('meta');
    registry.register('inst-A', p1);
    registry.register('inst-B', p2);

    expect(registry.get('meta', 'inst-A')).toBe(p1);
    expect(registry.get('meta', 'inst-B')).toBe(p2);
  });
});
