# Checklist de submissão da prova técnica

## Obrigatório antes de enviar

- [x] README completo e coerente com o código atual
- [x] projeto sobe com `pnpm install` e `pnpm dev`
- [x] webhook funcionando para pelo menos 2 providers (Meta, Evolution Baileys, Z-API — 3 testados)
- [x] normalização retornando formato único interno (`received`, `persisted`, `deduped`)
- [x] tratamento de erro demonstrável:
  - [x] provider desconhecido → `404 PROVIDER_NOT_FOUND`
  - [x] payload malformado → `400 WEBHOOK_PAYLOAD_INVALID`
  - [x] assinatura inválida → `401 WEBHOOK_SIGNATURE_INVALID`
- [x] banco funcionando com `pnpm db:up` + `pnpm db:migrate`
- [x] `.env.example` completo e sem secret real
- [ ] vídeo de até 10 minutos gravado
- [ ] repositório público no GitHub (atualmente privado)

## Diferenciais opcionais

- [x] idempotência demonstrada (mesmo webhook enviado 2x → `deduped: 1`)
- [ ] mostrar classificação real com LLM (mock funciona; real precisa de API key segura/rotacionada)
- [x] incluir diagrama simples do fluxo (`docs/diagrams/architecture-flow.md`)
- [x] cobertura de testes rodada e acima do threshold
- [x] testes com payloads simulados convincentes (3 providers × samples)

## Riscos que podem prejudicar a avaliação

- [x] ~~README vazio/desatualizado~~ → README completo com 362 linhas
- [x] ~~build quebrado~~ → `pnpm build` passa
- [x] ~~instruções de setup confusas~~ → README tem seção "Como rodar" detalhada
- [x] ~~dependência de secret real sem fallback~~ → fallback in-memory + mock classifier
- [x] ~~inconsistência entre documentação e código~~ → README reflete estado real
- [ ] vídeo ausente (ainda não gravado)
- [x] ~~cobertura abaixo do threshold~~ → cobertura agora passa: 87.01% lines

## Comandos de verificação rápida

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

## Vídeo / entregáveis

- [ ] Vídeo curto (até 10 min) mostrando:
  - [ ] Visão geral da solução
  - [ ] Fluxo de recebimento e normalização
  - [ ] Decisões técnicas relevantes
  - [ ] Diferenciais implementados
- [ ] Link do repositório público
- [ ] Link do vídeo (Google Drive ou YouTube público)

## Status da validação (2026-05-01)

| Verificação | Status | Detalhe |
|-------------|--------|---------|
| `pnpm lint` | ✅ | 0 errors, 37 warnings |
| `pnpm typecheck` | ✅ | sem erros |
| `pnpm test` | ✅ | 314 passed, 4 skipped |
| `pnpm test:coverage` | ✅ | lines 87.01%, statements 85.71%, functions 82.38%, branches 81% |
| `pnpm build` | ✅ | gera `dist/` |
| `pnpm dev` | ✅ | sobe na porta 3000 |
| Health check | ✅ | `GET /health` → ok |
| Webhook Meta | ✅ | HMAC-SHA256, `received:1, persisted:1` |
| Webhook Evolution | ✅ | apikey header, `received:1, persisted:1` |
| Webhook Z-API | ✅ | Client-Token header, `received:1, persisted:1` |
| Idempotência | ✅ | mesmo payload 2x → `deduped:1` |
| Erro: provider desconhecido | ✅ | `404 PROVIDER_NOT_FOUND` |
| Erro: payload malformado | ✅ | `400 WEBHOOK_PAYLOAD_INVALID` |
| Erro: assinatura inválida | ✅ | `401 WEBHOOK_SIGNATURE_INVALID` |
| `pnpm db:up` | ✅ | container Postgres rodando |
| `pnpm db:migrate` | ✅ | 001_init + 002_add_intent aplicadas |
| `.env.example` | ✅ | completo, sem secrets reais |
| Cobertura | ⚠️ | 78% lines (threshold: 80%) |
