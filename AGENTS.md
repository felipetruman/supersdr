# AGENTS.md

## Repo shape
- Single-package TypeScript repo. Run all commands from the repo root with `pnpm` only; `preinstall` blocks `npm`/`yarn` via `only-allow`.
- This is currently a provider-normalization library, not a wired Fastify app: `src/index.ts` is only `export const placeholder = 'ok'`.
- Core contract lives in `src/core/providers/provider.interface.ts`; normalized canonical event types live in `src/core/types/message.ts`.
- Provider adapters are isolated under `src/adapters/{meta,evolution-baileys,wppconnect,zapi}`. Tests mirror that layout under `src/tests/**`.
- `src/core/registry/provider-registry.ts` is the main composition point that maps `{provider name}:{instanceId}` to a provider implementation.

## Commands that matter
- Install: `pnpm install`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`
- Focus one test file: `pnpm test -- src/tests/providers/meta/meta.provider.test.ts`
- Coverage gate: `pnpm test:coverage` (Vitest thresholds: lines/functions/statements 80%, branches 75%)
- Build: `pnpm build` → outputs to `dist/` with runtime entry `dist/src/index.js`

## Verification / hooks
- Pre-commit runs `pnpm test` for the full suite. `lint-staged` exists, but the actual Husky gate is the test run, so don't assume a small staged-only check.
- Useful local sequence before finishing code changes: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- `pnpm build` currently compiles test files too and fails on a clean tree because `src/tests/providers/wppconnect/wppconnect.client.test.ts` uses a fetch mock signature that is narrower than `RequestInfo | URL`. Don't assume a build failure came from your change until you re-check that file.
- Vitest only includes `src/tests/**/*.test.ts`; files like `*.test.ts.bak` are ignored.

## Tooling quirks
- TypeScript is strict (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, etc.). Small dead code or unused args will fail `pnpm typecheck`.
- ESLint ignores `*.config.ts`, `*.config.js`, `src/db/migrations`, `dist`, and `coverage`. If you touch config or generated migration files, verify them manually because lint will not.
- `pnpm format` rewrites every `**/*.{ts,json,md}` file in the repo; avoid running it casually if you only need a surgical doc/code change.

## DB / infra drift to know before assuming
- `package.json` and `drizzle.config.ts` define DB scripts (`db:generate`, `db:migrate`, `db:seed`, `db:studio`), but the referenced files do not currently exist: `src/db/schema.ts`, `src/db/migrate.ts`, and `scripts/seed.ts` are missing.
- Docker only provides Postgres (`docker/docker-compose.yml`) on `localhost:5432` with `supersdr/supersdr/supersdr`. Confirm DB scaffolding exists before relying on any Drizzle workflow.

## Editing guidance
- If the task mentions “webhook handling”, start in the provider adapter for that vendor plus its mirrored tests under `src/tests/providers/...`.
- Do not invent Fastify routes, DB bootstrapping, or env-loading conventions that are not in the current tree; the executable source of truth says that wiring is not implemented yet.
