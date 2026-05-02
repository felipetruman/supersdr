// Public API — use buildServer + ProviderRegistry para montar a aplicação
export { buildServer } from './http/server.js';
export type { BuildServerDeps } from './http/server.js';
export { ProviderRegistry } from './core/registry/provider-registry.js';
export * from './core/errors/provider-error.js';
export type { WhatsAppProvider } from './core/providers/provider.interface.js';
export type {
  NormalizedEvent,
  NormalizedMessage,
  NormalizedStatusUpdate,
} from './core/types/message.js';
export type { OutboundMessage, SendResult } from './core/types/outbound.js';
