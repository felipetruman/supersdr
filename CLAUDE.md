# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> See AGENTS.md for commands, tooling quirks, and known broken scaffolding (DB, Fastify wiring).

## What this project is

A **provider-normalization library** — not a wired HTTP app. It converts raw webhook payloads from five WhatsApp providers (Meta, Evolution-Baileys, Evolution-Go, WPPConnect, Z-API) into a single canonical format, and exposes a uniform interface to send messages back.

## Architecture

### Core contract (`src/core/`)

Everything else depends on three files:

- `provider.interface.ts` — `WhatsAppProvider` interface every adapter must implement (`verifyWebhook`, `parseWebhook`, `sendMessage`, optional `handleVerification`)
- `types/message.ts` — canonical inbound types (`NormalizedEvent = message | status`, `NormalizedMessage`, `NormalizedStatusUpdate`)
- `types/outbound.ts` — canonical outbound types (`OutboundMessage`, `SendResult`)

The error hierarchy in `core/errors/provider-error.ts` (`WebhookSignatureError`, `WebhookValidationError`, `ProviderApiError`, `UnsupportedFeatureError`) is what the HTTP layer should catch and map to HTTP status codes when that layer gets built.

### Adapter pattern (`src/adapters/{provider}/`)

Each adapter is self-contained in four files:

| File | Role |
|------|------|
| `*.schemas.ts` | Zod schema for raw provider payload |
| `*.parser.ts` | Pure function: validated payload → `NormalizedEvent[]` |
| `*.client.ts` | HTTP calls to the provider API |
| `*.provider.ts` | Implements `WhatsAppProvider`; composes the other three |

**To add a new provider:** create a new directory with these four files plus `index.ts`, implement `WhatsAppProvider`, and register it in `ProviderRegistry`.

### Registry (`src/core/registry/provider-registry.ts`)

Composite key `name:instanceId` supports multi-tenant deployments where multiple WhatsApp accounts use the same provider type. Lookup throws if the provider isn't registered (not found = programming error, not user error).

## Tests

All tests live under `src/tests/**`, mirroring the adapter layout. The pre-commit hook runs the full test suite — there is no staged-only shortcut.

Run a single file:
```bash
pnpm test -- src/tests/providers/meta/meta.provider.test.ts
```

Coverage thresholds: 80% lines/functions/statements, 75% branches. Check with `pnpm test:coverage`.

## Known broken / not-yet-wired

- `src/index.ts` is a placeholder (`export const placeholder = 'ok'`) — no Fastify app is wired
- DB scripts (`db:generate`, `db:migrate`, `db:seed`) reference files that don't exist yet (`src/db/schema.ts`, `src/db/migrate.ts`, `scripts/seed.ts`)
- `pnpm build` may fail on the WPPConnect test mock type — see AGENTS.md for details
