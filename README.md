# SuperSDR — Sistema de Normalização de Webhooks

Implementação de uma prova técnica para um sistema de recebimento, normalização e persistência de mensagens de múltiplos provedores de WhatsApp.

O projeto recebe webhooks com formatos diferentes, converte tudo para um formato interno único, persiste com idempotência e pode classificar a intenção da mensagem com LLM em background.

## Objetivo

Resolver o problema de integração com múltiplos provedores de WhatsApp sem espalhar regras específicas de payload pelo sistema inteiro.

O sistema deve permitir:

- receber webhooks de múltiplos provedores
- normalizar os dados para um formato único
- adicionar novos provedores com baixo acoplamento
- tratar erros básicos com respostas coerentes
- persistir eventos normalizados
- classificar intenção da mensagem recebida

## Stack

- TypeScript
- Node.js
- Fastify
- PostgreSQL
- Vitest
- Zod
- Docker Compose

## Provedores implementados

- Meta (Cloud API)
- Evolution Baileys
- Evolution Go
- WPPConnect
- Z-API

> A prova exigia pelo menos 2 provedores implementados. Este projeto implementa 5.

## Arquitetura

```text
src/
├── adapters/   # código específico por provedor e intent classifiers
├── core/       # contratos, tipos, regras de domínio e registry
├── db/         # conexão, migrations e repositories
├── http/       # servidor, rotas e error handling
└── bootstrap.ts
```

Diagrama do fluxo principal:

- [`docs/diagrams/architecture-flow.md`](docs/diagrams/architecture-flow.md)

### Responsabilidade de cada camada

- `http/`: recebe requests HTTP, expõe rotas e traduz erros para HTTP
- `core/`: define contratos e o formato canônico interno
- `adapters/`: adapta payloads e APIs específicas de cada provedor
- `db/`: persiste eventos e classificações
- `bootstrap.ts`: faz o wiring da aplicação

## Pattern utilizado e justificativa

O projeto usa principalmente **Adapter Pattern**.

Cada provedor implementa a interface `WhatsAppProvider`, que padroniza 3 operações principais:

- `verifyWebhook`
- `parseWebhook`
- `sendMessage`

Isso resolve o problema de múltiplos formatos de entrada porque o restante do sistema não precisa conhecer detalhes da Meta, Z-API ou Evolution. Depois que o adapter converte o payload, todo o fluxo passa a trabalhar com `NormalizedEvent`.

Também existe um **Provider Registry**, responsável por resolver dinamicamente o provider correto via `provider + instanceId`.

### Benefícios dessa abordagem

- baixo acoplamento entre providers e core
- facilidade para adicionar novos providers
- melhor testabilidade
- separação clara de responsabilidades
- evita `if/else` espalhado pelo sistema inteiro

## Fluxo de processamento

1. O servidor recebe `POST /webhooks/:provider/:instanceId`
2. O `ProviderRegistry` resolve o adapter correto
3. O adapter valida assinatura/token do webhook
4. O adapter parseia o payload e retorna `NormalizedEvent[]`
5. O repositório salva os eventos de forma idempotente
6. Se houver texto, o `IntentService` dispara classificação em background
7. A API responde rápido com resumo de `received`, `persisted` e `deduped`

## Formato normalizado

O formato canônico está em:

- `src/core/types/message.ts`

Ele padroniza:

- provider
- instanceId
- direction
- type
- contatos de origem/destino
- conteúdo textual e de mídia
- status de mensagem
- timestamp
- payload bruto original

Isso permite tratar mensagens de qualquer provedor com a mesma estrutura interna.

## Como rodar o projeto

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Configurar ambiente

Crie um `.env` a partir de `.env.example`.

Exemplo mínimo para rodar sem banco e sem LLM real:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info
INTENT_CLASSIFIER=mock
```

### 3. Rodar em modo desenvolvimento

```bash
pnpm dev
```

### 4. Healthcheck

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/providers
```

## Banco de dados

O projeto funciona em dois modos:

- **in-memory** quando `DATABASE_URL` não está definido
- **PostgreSQL** quando `DATABASE_URL` está configurado

### Subir Postgres com Docker

```bash
pnpm db:up
```

### Aplicar migrations

```bash
pnpm db:migrate
```

### Desligar banco

```bash
pnpm db:down
```

## Estrutura de banco de dados

As migrations principais são:

- `src/db/migrations/001_init.sql`
- `src/db/migrations/002_add_intent.sql`

### Modelagem adotada

Tabela principal: `message_events`

Campos importantes:

- `provider`
- `instance_id`
- `provider_message_id`
- `kind`
- `event_timestamp`
- `normalized` (JSONB)
- `raw_payload` (JSONB)
- colunas auxiliares para busca (`from_phone`, `text_content`, `status`, etc.)
- colunas de classificação (`intent`, `intent_confidence`, `intent_provider`, `intent_model`)

### Idempotência

Existe constraint única composta para evitar duplicidade do mesmo evento:

- `provider`
- `instance_id`
- `provider_message_id`
- `kind`

## Tratamento de erros

O sistema lida explicitamente com:

- webhook malformado → `400`
- assinatura inválida → `401`
- provider desconhecido → `404`
- feature não suportada → `422`
- falha upstream de provider → `502`
- erro interno genérico → `500`

Arquivo principal:

- `src/http/errors/error-handler.ts`

## Integração com LLM

O projeto inclui uma integração de classificação de intenção.

Arquivos principais:

- `src/core/services/intent.service.ts`
- `src/adapters/intent/factory.ts`
- `src/adapters/intent/openai-compat.classifier.ts`

### O que ele faz

- classifica a intenção da mensagem recebida
- persiste o resultado
- roda em background para não atrasar o ACK do webhook

### Modos disponíveis

- `mock` para desenvolvimento/CI sem custo
- providers OpenAI-compatible como `openai`, `groq`, `gemini`, `ollama`, `openrouter` e `custom`

### Exemplo com Gemini real

O adapter usa endpoint OpenAI-compatible. Para testar Gemini de verdade, configure **apenas localmente** no `.env`:

```env
INTENT_CLASSIFIER=gemini
INTENT_API_KEY=sua-chave-local
INTENT_MODEL=gemini-1.5-flash
INTENT_TIMEOUT_MS=8000
```

Não commite chaves reais. Se uma chave foi exposta em chat, logs ou repositório, considere comprometida e rotacione antes de publicar.

## Como testar o fluxo principal

### Rodar testes

```bash
pnpm test
```

### Cobertura

```bash
pnpm test:coverage
```

### Verificações locais recomendadas

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Exemplo de webhook

Payloads de exemplo estão em:

- `samples/meta-text.json`
- `samples/evolution-baileys-text.json`
- `samples/zapi-text.json`

Exemplo de chamada:

```bash
curl -X POST http://localhost:3000/webhooks/meta/default \
  -H 'content-type: application/json' \
  --data @samples/meta-text.json
```

> Para Meta e outros providers com validação real de assinatura, o payload precisa respeitar os headers esperados pelo adapter quando o fluxo completo estiver sendo exercitado.

## Como adicionar um novo provedor

Para adicionar um novo provider:

1. criar uma pasta em `src/adapters/<novo-provider>/`
2. implementar a interface `WhatsAppProvider`
3. criar schema/parse do payload
4. criar client de envio, se necessário
5. registrar o provider no `bootstrap.ts`
6. adicionar testes para provider, parser e client
7. **adicionar o nome ao union literal `ProviderName` em `src/core/types/message.ts`**

### Trade-off do `ProviderName` (decisão consciente)

`ProviderName` é um **union literal fechado** (`'meta' | 'evolution-baileys' | ...`) em vez de `string`. Consequência: **adicionar um provider exige uma edição mínima no core** (uma linha).

Por que mantemos assim:

- **Type-safety end-to-end**: o compilador valida `provider: ProviderName` em rotas, registry, repositório e testes. Provider digitado errado vira erro de build, não bug em runtime.
- **Discriminated unions confiáveis**: parsers e exhaustive checks no TypeScript ficam corretos sem `default` defensivo.
- **Documentação implícita**: `Ctrl+click` no tipo lista todos os providers suportados.

Quando esse trade-off NÃO valeria a pena: se o sistema precisasse aceitar providers definidos só em runtime (plugins dinâmicos, multi-tenant com providers diferentes por cliente sem deploy). Não é o caso aqui.

Fora essa única linha, o restante do sistema continua igual porque consome apenas o contrato comum (`WhatsAppProvider`).

## Funcionalidades implementadas

- [x] recebimento de webhook multi-provedor
- [x] normalização para formato único interno
- [x] pelo menos 2 provedores implementados
- [x] extensibilidade via adapter pattern
- [x] tratamento básico de erros
- [x] persistência em PostgreSQL
- [x] fallback in-memory para dev/teste
- [x] classificação de intenção com LLM/mock
- [x] testes automatizados

## Decisões técnicas principais

### 1. Fastify na camada HTTP
Escolhido por simplicidade, performance e boa experiência para rotas e testes com `inject`.

### 2. Zod para validação
Cada provider valida seu payload antes de normalizar, reduzindo risco de runtime error em payload malformado.

### 3. JSONB no Postgres
Permite guardar o evento normalizado e o payload bruto para debug, replay e evolução futura do schema.

### 4. ACK rápido + classificação em background
Evita atrasar resposta para providers que exigem webhook responsivo.

### 5. Repositório com idempotência
Evita duplicação quando o mesmo webhook é reenviado pelo provedor.

## Desafios encontrados

- lidar com payloads heterogêneos de múltiplos provedores
- preservar `rawBody` para validação de assinatura HMAC
- manter o core isolado de detalhes específicos de cada API
- equilibrar persistência estruturada com flexibilidade para payloads diferentes
- integrar classificação sem impactar o tempo de resposta do webhook

## Limitações conhecidas (decisões conscientes para escopo da prova)

### Registry em memória — single-pod

`ProviderRegistry` mantém um `Map` em memória inicializado no boot a partir de variáveis de ambiente (`src/bootstrap.ts`). Funciona bem em deploy single-instance. Para escalar horizontal (vários pods/réplicas) seria necessário um store compartilhado (Postgres com row-per-instance, Redis, etc) para que registrar/atualizar provider em runtime fosse propagado entre instâncias. Hoje, qualquer mudança exige restart de todos os pods.

### WPPConnect: signature plain-string, não criptográfica

WPPConnect-server não emite assinatura HMAC nativa; o adapter compara um header (`x-webhook-secret`) por igualdade simples. Segurança real depende de:

- TLS no canal (HTTPS sempre)
- segredo forte e rotacionado
- restrição de IP no reverse proxy quando possível

Meta usa HMAC-SHA256 com `crypto.timingSafeEqual` (`src/adapters/meta/meta.signature.ts`). Os demais providers (Evolution Baileys/Go, Z-API) usam tokens em headers — comparações plain-string protegidas pelo TLS.

### Classificação de intenção — fire-and-forget sem retry

`IntentService.classifyInBackground` dispara a classificação fora do ciclo de request para não atrasar o ACK do webhook (Meta exige <5s). Trade-off: se a chamada ao LLM falhar (timeout, 429, crash), o resultado é perdido sem recovery. Para produção crítica seria necessário queue persistente (BullMQ, pg-boss, SQS). Aceitável para MVP/demonstração.

### `ProviderName` é union literal fechado

Já documentado em [§ Trade-off do `ProviderName`](#trade-off-do-providername-decisão-consciente).

## Uso de IA

IA foi utilizada como ferramenta de produtividade para:

- acelerar estruturação inicial da arquitetura
- gerar rascunhos de implementação
- revisar casos de teste
- refinar documentação

Todo output gerado com apoio de IA foi revisado, ajustado e validado manualmente no contexto do projeto.

## Entregáveis da prova

Para submissão final, além do código funcional, este projeto deve ser acompanhado de:

- repositório público no GitHub
- README atualizado
- vídeo de apresentação de até 10 minutos

## Status de validação

| Verificação | Status |
|-------------|--------|
| `pnpm lint` | ✅ passou (warnings aceitáveis) |
| `pnpm typecheck` | ✅ passou |
| `pnpm test` | ✅ testes passando |
| `pnpm test:coverage` | ✅ acima dos thresholds globais |
| `pnpm build` | ✅ gera `dist/` com sucesso |

## Observações finais

- `src/index.ts` está minimalista e o ponto de entrada real da aplicação é `src/bootstrap.ts`
- o projeto foi estruturado para priorizar clareza, extensibilidade e pragmatismo
- a solução não depende de um único provedor e pode crescer com novos adapters
