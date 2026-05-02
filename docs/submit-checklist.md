# Checklist de submissão da prova técnica

## Obrigatório antes de enviar

- [x] README completo e coerente com o código atual (380 linhas)
- [x] projeto sobe com `pnpm install` e `pnpm dev`
- [x] webhook funcionando para pelo menos 2 providers (5 implementados: Meta, Evolution Baileys, Evolution Go, WPPConnect, Z-API)
- [x] normalização retornando formato único interno (`received`, `persisted`, `deduped`)
- [x] tratamento de erro demonstrável:
  - [x] provider desconhecido → `404 PROVIDER_NOT_FOUND`
  - [x] payload malformado → `400 WEBHOOK_PAYLOAD_INVALID`
  - [x] assinatura inválida → `401 WEBHOOK_SIGNATURE_INVALID`
  - [x] feature não suportada → `422 UNSUPPORTED_FEATURE`
  - [x] falha upstream do provider → `502 PROVIDER_UPSTREAM_ERROR`
- [x] banco funcionando com `pnpm db:up` + `pnpm db:migrate`
- [x] readiness probe (`GET /health/ready` faz `SELECT 1`)
- [x] `.env.example` completo e sem secret real
- [ ] vídeo de até 10 minutos gravado
- [ ] repositório público no GitHub (atualmente PRIVATE — precisa virar PUBLIC antes de submeter)

## Diferenciais opcionais

- [x] idempotência demonstrada (mesmo webhook enviado 2x → `deduped: 1`)
- [x] classificação de intenção via LLM (mock default; OpenAI-compatible suporta groq/openai/gemini/ollama/openrouter/custom)
- [x] diagrama do fluxo (`docs/diagrams/architecture-flow.md`)
- [x] cobertura de testes acima do threshold (lines 86.82% / threshold 80%)
- [x] testes com payloads simulados convincentes (5 providers × samples)
- [x] auditoria técnica completa documentada (`docs/auditoria-prova-tecnica-vs-implementacao.md`)

## Riscos que podem prejudicar a avaliação

- [x] ~~README vazio/desatualizado~~ → README completo (380 linhas), sincronizado com código
- [x] ~~build quebrado~~ → `pnpm build` passa
- [x] ~~instruções de setup confusas~~ → seção "Como rodar" detalhada
- [x] ~~dependência de secret real sem fallback~~ → fallback in-memory + mock classifier
- [x] ~~inconsistência entre documentação e código~~ → README + AGENTS + CLAUDE.md alinhados
- [x] ~~scripts `db:*` quebrados~~ → schema.ts + seed.ts criados (PR #5)
- [x] ~~clients HTTP sem timeout~~ → AbortController 15s default (PR #5)
- [ ] vídeo ausente (ainda não gravado)
- [ ] repo PRIVATE (precisa ser público pra submissão)

## Comandos de verificação rápida

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build

# Smoke test ponta-a-ponta
pnpm db:up && pnpm db:migrate
DATABASE_URL=postgres://supersdr:supersdr@localhost:55432/supersdr pnpm dev
# Em outro shell:
curl -s http://localhost:3000/health
curl -s http://localhost:3000/health/ready
curl -s http://localhost:3000/health/providers
```

## Vídeo / entregáveis

- [ ] Vídeo curto (até 10 min) mostrando:
  - [ ] Visão geral da solução
  - [ ] Fluxo de recebimento e normalização
  - [ ] Decisões técnicas relevantes (Adapter + Registry, Repository, IntentClassifier port)
  - [ ] Diferenciais implementados (5 providers, LLM real, idempotência, readiness probe)
- [ ] Link do repositório público
- [ ] Link do vídeo (Google Drive ou YouTube público)

## Status da validação (2026-05-02 — pós PR #5)

| Verificação | Status | Detalhe |
|-------------|--------|---------|
| `pnpm lint` | ✅ | passa (warnings de estilo aceitáveis) |
| `pnpm typecheck` | ✅ | sem erros |
| `pnpm test` | ✅ | 319 passed, 4 skipped (32 arquivos) |
| `pnpm test:coverage` | ✅ | lines 86.82%, statements 85.33%, functions 80.72%, branches 81.36% (todos acima do threshold) |
| `pnpm build` | ✅ | gera `dist/` |
| `pnpm dev` | ✅ | sobe na porta 3000 |
| `drizzle-kit check` | ✅ | schema válido |
| Liveness `GET /health` | ✅ | `{ status: 'ok' }` |
| Readiness `GET /health/ready` | ✅ | `SELECT 1` quando DB ativo; 503 se cair |
| `GET /health/providers` | ✅ | lista provedores registrados |
| Webhook Meta | ✅ | HMAC-SHA256 timing-safe, `received:1, persisted:1` |
| Webhook Evolution Baileys | ✅ | apikey header, `received:1, persisted:1` |
| Webhook Evolution Go | ✅ | apikey + instance header |
| Webhook WPPConnect | ✅ | Bearer token + opt webhook secret |
| Webhook Z-API | ✅ | Client-Token header |
| Idempotência | ✅ | mesmo payload 2x → `deduped:1` |
| Erro: provider desconhecido | ✅ | `404 PROVIDER_NOT_FOUND` |
| Erro: payload malformado | ✅ | `400 WEBHOOK_PAYLOAD_INVALID` |
| Erro: assinatura inválida | ✅ | `401 WEBHOOK_SIGNATURE_INVALID` |
| Erro: feature não suportada | ✅ | `422 UNSUPPORTED_FEATURE` |
| Erro: provider upstream | ✅ | `502 PROVIDER_UPSTREAM_ERROR` |
| `pnpm db:up` | ✅ | container Postgres rodando |
| `pnpm db:migrate` | ✅ | 001_init + 002_add_intent aplicadas |
| `pnpm db:seed` | ✅ | 2 eventos sample inseridos |
| `pnpm db:generate` | ✅ | schema.ts presente |
| `pnpm db:studio` | ✅ | Drizzle Studio abre |
| `.env.example` | ✅ | completo, sem secrets reais |
| Cobertura | ✅ | acima de todos os thresholds |
| Classificação LLM (mock) | ✅ | 7 categorias, fire-and-forget background |
| Classificação LLM (real) | ⚠️ | não testada nesta validação (precisa API key) |
