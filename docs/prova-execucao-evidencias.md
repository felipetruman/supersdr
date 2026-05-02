# Evidências de Execução — SuperSDR
**Data:** 2026-05-02 18:00 UTC  
**Versão:** main (pós PR #8)

Este documento comprova que o sistema de normalização de webhooks funciona conforme requisitado na Prova Técnica. Todos os outputs abaixo são reais, coletados de uma execução local com banco PostgreSQL e classificação de intenção via Gemini 2.5 Flash.

---

## 1. Ambiente

```
Runtime:           Node.js 22 (tsx watch)
Framework:         Fastify 5
Banco de dados:    PostgreSQL 16 (Docker, porta 55432)
Intent Classifier: Gemini 2.5 Flash (Google)
```

---

## 2. Providers Registrados

Requisição:
```
GET http://localhost:3000/health/providers
```

Resposta (`HTTP 200`):
```json
{
  "registered": [
    { "name": "meta",              "instanceId": "default" },
    { "name": "evolution-baileys", "instanceId": "meucel" },
    { "name": "evolution-go",      "instanceId": "cel-novo" },
    { "name": "zapi",              "instanceId": "3F27EDBFCE6BC1AE134112DF64D7129F" }
  ]
}
```

> WPPConnect não aparece: `WPPCONNECT_BASE_URL` está vazio no `.env`, portanto o adapter não é registrado. Comportamento correto — sem configuração, sem registro.

---

## 3. Health Checks

### 3.1 Liveness (`/health`)
```
GET http://localhost:3000/health
HTTP/1.1 200 OK
```
```json
{
  "status": "ok",
  "uptime": 23.962659542,
  "timestamp": "2026-05-02T17:58:52.937Z"
}
```

### 3.2 Readiness (`/health/ready`)
```
GET http://localhost:3000/health/ready
HTTP/1.1 200 OK
```
```json
{
  "status": "ready",
  "uptime": 26.650697884,
  "timestamp": "2026-05-02T17:58:55.625Z",
  "db": { "kind": "ok" }
}
```
`db.kind: "ok"` confirma que o SELECT 1 no PostgreSQL foi executado com sucesso.

---

## 4. Webhooks — Chamadas e Respostas

### 4.1 Meta (Cloud API)

**Payload de entrada** (formato Meta):
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "PROOF2_WABA",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "5547888888888", "phone_number_id": "1234567890" },
        "contacts": [{ "profile": { "name": "Maria Proof2" }, "wa_id": "5547911111111" }],
        "messages": [{
          "from": "5547911111111",
          "id": "proof2-meta-001",
          "timestamp": "1746291600",
          "type": "text",
          "text": { "body": "Quero contratar o plano premium" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Assinatura HMAC-SHA256** (calculada com `META_APP_SECRET`):
```
x-hub-signature-256: sha256=c15db739deb917fc04433056ff85ec77b7967fc107e5bbff06239f83c4b5c4c2
```

**Chamada cURL:**
```bash
curl -X POST http://localhost:3000/webhooks/meta/default \
  -H 'content-type: application/json' \
  -H 'x-hub-signature-256: sha256=c15db739deb917fc04433056ff85ec77b7967fc107e5bbff06239f83c4b5c4c2' \
  -d '<payload acima>'
```

**Resposta** (`HTTP 200`):
```json
{ "received": 1, "persisted": 1, "deduped": 0 }
```

---

### 4.2 Evolution-Baileys

**Payload de entrada** (formato Evolution API):
```json
{
  "event": "messages.upsert",
  "instance": "meucel",
  "data": {
    "key": {
      "remoteJid": "5547922222222@s.whatsapp.net",
      "fromMe": false,
      "id": "proof2-evbaileys-001"
    },
    "pushName": "Carlos Proof2",
    "message": { "conversation": "Preciso de suporte tecnico urgente" },
    "messageType": "conversation",
    "messageTimestamp": 1746291600
  }
}
```

**Chamada cURL:**
```bash
curl -X POST http://localhost:3000/webhooks/evolution-baileys/meucel \
  -H 'content-type: application/json' \
  -H 'apikey: 554599022026@s.whatsapp.net' \
  -d '<payload acima>'
```

**Resposta** (`HTTP 200`):
```json
{ "received": 1, "persisted": 1, "deduped": 0 }
```

---

### 4.3 Evolution-Go

**Payload de entrada** (formato Evolution Go):
```json
{
  "event": "messages.upsert",
  "instance": "cel-novo",
  "data": {
    "key": {
      "remoteJid": "5547933333333@s.whatsapp.net",
      "fromMe": false,
      "id": "proof2-evgo-001"
    },
    "pushName": "Ana Proof2",
    "message": { "conversation": "Qual o horario de funcionamento?" },
    "messageType": "conversation",
    "messageTimestamp": 1746291600
  },
  "destination": "5547888888888@s.whatsapp.net",
  "date_time": "2026-05-02T18:00:00.000Z"
}
```

**Chamada cURL:**
```bash
curl -X POST http://localhost:3000/webhooks/evolution-go/cel-novo \
  -H 'content-type: application/json' \
  -H 'apikey: 167b9262-3d55-4cf8-a81b-8bb18d186bb5' \
  -d '<payload acima>'
```

**Resposta** (`HTTP 200`):
```json
{ "received": 1, "persisted": 1, "deduped": 0 }
```

---

### 4.4 Z-API

**Payload de entrada** (formato Z-API):
```json
{
  "instanceId": "3F27EDBFCE6BC1AE134112DF64D7129F",
  "messageId": "proof2-zapi-001",
  "phone": "5547944444444",
  "fromMe": false,
  "momment": 1746291600000,
  "status": "RECEIVED",
  "chatName": "Pedro Proof2",
  "senderName": "Pedro Proof2",
  "participantPhone": null,
  "broadcast": false,
  "type": "ReceivedCallback",
  "text": { "message": "Quero fazer um pedido de 10 unidades" }
}
```

**Chamada cURL:**
```bash
curl -X POST 'http://localhost:3000/webhooks/zapi/3F27EDBFCE6BC1AE134112DF64D7129F' \
  -H 'content-type: application/json' \
  -d '<payload acima>'
```

**Resposta** (`HTTP 200`):
```json
{ "received": 1, "persisted": 1, "deduped": 0 }
```

---

## 5. Normalização — Formato Único

Os 4 payloads acima têm estruturas completamente diferentes. Após processamento, **todos são armazenados no mesmo formato canônico**. Evidência direta do banco de dados:

```sql
SELECT provider, provider_message_id, direction, message_type,
       from_phone, from_name, to_phone, text_content
FROM message_events
WHERE provider_message_id LIKE 'proof2-%'
ORDER BY created_at ASC;
```

Resultado:

```
     provider      |   provider_message_id   | direction | message_type |  from_phone   |  from_name    |   to_phone    |             text_content
-------------------+-------------------------+-----------+--------------+---------------+---------------+---------------+--------------------------------------
 meta              | proof2-meta-001         | inbound   | text         | 5547911111111 | Maria Proof2  | 5547888888888 | Quero contratar o plano premium
 evolution-baileys | proof2-evbaileys-001    | inbound   | text         | 5547922222222 | Carlos Proof2 |               | Preciso de suporte tecnico urgente
 evolution-go      | proof2-evgo-001         | inbound   | text         | 5547933333333 | Ana Proof2    |               | Qual o horario de funcionamento?
 zapi              | proof2-zapi-001         | inbound   | text         | 5547944444444 | Pedro Proof2  | 5547944444444 | Quero fazer um pedido de 10 unidades
```

> **Ponto-chave:** 4 providers com formatos de webhook totalmente distintos (`object/entry/changes`, `event/instance/data`, `event/data/key`, `instanceId/messageId/phone`) → todos normalizados para as mesmas colunas relacionais. É isso que o sistema entrega.

---

## 6. Classificação de Intenção (LLM — Gemini 2.5 Flash)

A classificação roda em background (fire-and-forget) após persistir o evento. Resultado após conclusão:

```sql
SELECT provider, provider_message_id, intent, intent_confidence, intent_provider
FROM message_events
WHERE provider_message_id LIKE 'proof2-%'
ORDER BY created_at ASC;
```

Resultado:

```
     provider      |   provider_message_id   |     intent      | intent_confidence | intent_provider
-------------------+-------------------------+-----------------+-------------------+-----------------
 meta              | proof2-meta-001         | sales_inquiry   |             0.950 | gemini
 evolution-baileys | proof2-evbaileys-001    | support_request |             0.950 | gemini
 evolution-go      | proof2-evgo-001         | support_request |             0.900 | gemini
 zapi              | proof2-zapi-001         | sales_inquiry   |             0.900 | gemini
```

O Gemini classificou corretamente:
- "Quero contratar o plano premium" → `sales_inquiry` (0.95)
- "Preciso de suporte tecnico urgente" → `support_request` (0.95)
- "Qual o horario de funcionamento?" → `support_request` (0.90)
- "Quero fazer um pedido de 10 unidades" → `sales_inquiry` (0.90)

---

## 7. Tratamento de Erros

### 7.1 Assinatura inválida → `401 Unauthorized`

```bash
curl -X POST http://localhost:3000/webhooks/meta/default \
  -H 'content-type: application/json' \
  -H 'x-hub-signature-256: sha256=0000000000000000000000000000000000000000000000000000000000000000' \
  -d '{"object":"whatsapp_business_account","entry":[]}'
```

```
HTTP/1.1 401 Unauthorized
```
```json
{
  "error": {
    "code": "WEBHOOK_SIGNATURE_INVALID",
    "message": "Invalid webhook signature",
    "provider": "meta"
  }
}
```

---

### 7.2 Provider não registrado → `404 Not Found`

```bash
curl -X POST http://localhost:3000/webhooks/provedor-inexistente/qualquer \
  -H 'content-type: application/json' \
  -d '{}'
```

```
HTTP/1.1 404 Not Found
```
```json
{
  "error": {
    "code": "PROVIDER_NOT_FOUND",
    "message": "Provider not registered: provedor-inexistente:qualquer",
    "provider": "provedor-inexistente"
  }
}
```

---

### 7.3 Payload malformado → `400 Bad Request`

```bash
curl -X POST http://localhost:3000/webhooks/evolution-go/cel-novo \
  -H 'content-type: application/json' \
  -H 'apikey: 167b9262-3d55-4cf8-a81b-8bb18d186bb5' \
  -d '{"event":"messages.upsert","instance":"cel-novo"}'
```
# (sem o campo obrigatório "data")

```
HTTP/1.1 400 Bad Request
```
```json
{
  "error": {
    "code": "WEBHOOK_PAYLOAD_INVALID",
    "message": "Invalid webhook payload",
    "provider": "evolution-go",
    "details": {
      "formErrors": [],
      "fieldErrors": {
        "data": ["Invalid input: expected object, received undefined"]
      }
    }
  }
}
```

---

### 7.4 Falha no processamento → `500 Internal Server Error`

Cenário: webhook com assinatura válida e payload correto, mas banco de dados indisponível no momento do `saveEvent`.

**Fluxo:**
1. Assinatura HMAC verificada com sucesso
2. Payload parseado com sucesso (`NormalizedEvent` gerado)
3. `repository.saveEvent()` lança erro de conexão (`ECONNREFUSED` — Postgres parado)
4. `httpErrorHandler` captura, loga internamente (stack completo), retorna 500 sem vazar detalhes

```bash
# (com PostgreSQL parado via docker stop)
curl -X POST http://localhost:3000/webhooks/meta/default \
  -H 'content-type: application/json' \
  -H 'x-hub-signature-256: <assinatura válida>' \
  -d '<payload válido>'
```

```
HTTP/1.1 500 Internal Server Error
```
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

**Por que não vaza detalhes:** o handler (`src/http/errors/error-handler.ts:109`) faz `request.log.error({ err }, 'unhandled error')` internamente e retorna apenas `INTERNAL_ERROR` para o cliente — stack trace fica nos logs do servidor, não exposto.

Após reiniciar o banco (`docker start supersdr-postgres`), o servidor reconectou automaticamente:
```json
{ "status": "ready", "db": { "kind": "ok" } }
```

---

## 8. Idempotência

O mesmo payload enviado duas vezes não gera duplicata no banco:

**Primeira chamada:**
```json
{ "received": 1, "persisted": 1, "deduped": 0 }
```

**Segunda chamada (mesmo payload, mesmo `id`):**
```bash
curl -X POST http://localhost:3000/webhooks/meta/default \
  -H 'content-type: application/json' \
  -H 'x-hub-signature-256: sha256=c15db739deb917fc04433056ff85ec77b7967fc107e5bbff06239f83c4b5c4c2' \
  -d '{ ...mesmo payload com id "proof2-meta-001"... }'
```
```
HTTP/1.1 200 OK
```
```json
{ "received": 1, "persisted": 0, "deduped": 1 }
```

`deduped: 1` → evento detectado como duplicata pela constraint `UNIQUE (provider, instance_id, provider_message_id, kind)`. Retorna `200` (não um erro) porque a entrega duplicada é comportamento normal de webhooks.

---

## 9. Testes Automatizados

```
pnpm test

 Test Files  32 passed | 1 skipped (33)
      Tests  323 passed | 4 skipped (327)
   Duration  604ms
```

```
pnpm typecheck

(zero erros TypeScript)
```

---

## 10. Checklist de Requisitos da Prova

| Requisito | Status | Evidência |
|-----------|--------|-----------|
| **1.1** Estrutura com camadas | ✅ | `src/{core,adapters,db,http}` — 4 camadas distintas |
| **1.2** ≥2 providers implementados | ✅ | 5 providers: Meta, Evolution-Baileys, Evolution-Go, WPPConnect, Z-API |
| **1.2** Código funcional | ✅ | Seções 4.1–4.4 acima |
| **1.3** Justificativa do pattern | ✅ | README §"Pattern utilizado e justificativa" |
| **1.4** Extensibilidade | ✅ | README §"Como adicionar um novo provedor" |
| **1.5** Webhook malformado | ✅ | Seção 7.3: HTTP 400 com detalhes Zod |
| **1.5** Provider desconhecido | ✅ | Seção 7.2: HTTP 404 |
| **1.5** Assinatura inválida | ✅ | Seção 7.1: HTTP 401 |
| **2.1** Schema de banco de dados | ✅ | `src/db/migrations/001_init.sql` + `002_add_intent.sql` |
| **2.2** Integração com LLM | ✅ | Seção 6: Gemini 2.5 Flash com confiança e label |
| Stack TypeScript + Node.js + PostgreSQL | ✅ | Confirmado |
| Git + GitHub + commits descritivos | ✅ | 8 PRs merged, conventional commits |
| **Diferencial:** testes unitários | ✅ | 323 testes passando |
| **Diferencial:** LLM implementado | ✅ | Seção 6 (não apenas descrito) |
| **Diferencial:** fluxo visual | ✅ | `docs/diagrams/architecture-flow.md` |
