# AGENTS.md

## Repo shape
- Single-package TypeScript repo. Run all commands from the repo root with `pnpm` only; `preinstall` blocks `npm`/`yarn` via `only-allow`.
- This is a wired Fastify app for WhatsApp webhook normalization. The runtime entrypoint is `src/bootstrap.ts`; `src/index.ts` is only a minimal placeholder/export.
- Core contract lives in `src/core/providers/provider.interface.ts`; normalized canonical event types live in `src/core/types/message.ts`.
- Provider adapters are isolated under `src/adapters/{meta,evolution-baileys,evolution-go,wppconnect,zapi}`. Tests mirror that layout under `src/tests/**`.
- `src/core/registry/provider-registry.ts` maps `{provider name}:{instanceId}` to a provider implementation.
- HTTP routes live in `src/http/**`, especially `src/http/routes/webhooks.ts`.
- Persistence lives in `src/db/**` with in-memory repositories for dev/tests and Postgres repositories for runtime when `DATABASE_URL` is present.
- Intent classification lives in `src/core/services/intent.service.ts` and `src/adapters/intent/**`. It supports mock mode and OpenAI-compatible providers.

## Commands that matter
- Install: `pnpm install`
- Dev server: `pnpm dev` → runs `src/bootstrap.ts`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`
- Focus one test file: `pnpm test -- src/tests/providers/meta/meta.provider.test.ts`
- Coverage gate: `pnpm test:coverage` (Vitest thresholds: lines/functions/statements 80%, branches 75%)
- Build: `pnpm build` → outputs to `dist/`
- DB up: `pnpm db:up`
- DB migrate: `pnpm db:migrate`

## Verification / hooks
- Useful local sequence before finishing code changes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage && pnpm build`.
- Vitest only includes `src/tests/**/*.test.ts`; files like `*.test.ts.bak` are ignored.
- `pnpm test:coverage` is expected to pass the configured thresholds. If it fails, first add focused tests instead of lowering thresholds.

## Tooling quirks
- TypeScript is strict (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, etc.). Small dead code or unused args will fail `pnpm typecheck`.
- ESLint ignores `*.config.ts`, `*.config.js`, `src/db/migrations`, `dist`, and `coverage`. If you touch config or generated migration files, verify them manually because lint will not.
- `pnpm format` rewrites every `**/*.{ts,json,md}` file in the repo; avoid running it casually if you only need a surgical doc/code change.

## DB / infra
- Migrations exist in `src/db/migrations/` and are applied by `src/db/migrate.ts`.
- Docker provides Postgres via compose. Use `pnpm db:up` and `pnpm db:migrate` for local DB validation.
- If `DATABASE_URL` is omitted, runtime falls back to in-memory repositories.

## Secrets / LLM
- Never commit `.env` or real provider/API keys.
- `.env.example` must contain placeholders only.
- If testing Gemini/OpenAI/Groq/OpenRouter locally, set `INTENT_API_KEY` only in your local `.env` or shell environment.
- API keys pasted into chat/logs should be treated as compromised and rotated before publication.

## Editing guidance
- If the task mentions “webhook handling”, start in the provider adapter for that vendor plus its mirrored tests under `src/tests/providers/...`.
- Preserve the custom JSON parser in `src/http/server.ts`; it stores `rawBody`, required for webhook signature validation.
- New providers should implement `WhatsAppProvider`, parse into `NormalizedEvent[]`, and be registered in `src/bootstrap.ts`.
- For route behavior, prefer Fastify `app.inject` tests under `src/tests/http/**`.
