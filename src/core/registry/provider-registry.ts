import type { ProviderName } from '../types/message.js';
import type { WhatsAppProvider } from '../providers/provider.interface.js';

/**
 * Registry simples — resolve provider por nome + instância.
 * Em produção pode evoluir pra carregar configs do DB.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, WhatsAppProvider>();

  private key(name: ProviderName, instanceId: string): string {
    return `${name}:${instanceId}`;
  }

  register(instanceId: string, provider: WhatsAppProvider): void {
    this.providers.set(this.key(provider.name, instanceId), provider);
  }

  get(name: ProviderName, instanceId: string): WhatsAppProvider {
    const provider = this.providers.get(this.key(name, instanceId));
    if (!provider) {
      throw new Error(`Provider not registered: ${name}:${instanceId}`);
    }
    return provider;
  }

  has(name: ProviderName, instanceId: string): boolean {
    return this.providers.has(this.key(name, instanceId));
  }

  list(): Array<{ name: ProviderName; instanceId: string }> {
    return Array.from(this.providers.keys()).map((key) => {
      const [name, instanceId] = key.split(':') as [ProviderName, string];
      return { name, instanceId };
    });
  }
}
