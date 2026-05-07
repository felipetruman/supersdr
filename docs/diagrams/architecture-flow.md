# Fluxo de arquitetura — SuperSDR

Este diagrama resume o caminho de um webhook desde a chegada no servidor até a normalização, persistência e classificação de intenção.

```mermaid
flowchart TD
  A[Provider WhatsApp<br/>Meta / Evolution / Z-API] --> B[Fastify<br/>POST /webhooks/:provider/:instanceId]
  B --> C[ProviderRegistry<br/>resolve provider + instanceId]
  C --> D[WhatsAppProvider Adapter]

  D --> E[verifyWebhook<br/>HMAC / token / apikey]
  E --> F[parseWebhook<br/>schema + parser do provider]
  F --> G["NormalizedEvent[]<br/>formato canônico interno"]

  G --> H[MessageRepository]
  H --> I{DATABASE_URL?}
  I -->|sim| J[(PostgreSQL<br/>message_events)]
  I -->|não| K[InMemoryRepository<br/>dev/test]

  G --> L{Mensagem com texto?}
  L -->|sim| M[IntentService<br/>fire-and-forget]
  M --> N[IntentClassifier<br/>mock ou OpenAI-compatible]
  N --> O[IntentRepository<br/>salva intent]
  L -->|não| P[ACK imediato]

  J --> P
  K --> P
  O --> P
  P --> Q[Resposta 200<br/>received / persisted / deduped]
```

## Ponto de extensibilidade

Para adicionar um novo provedor, crie um adapter que implemente `WhatsAppProvider` e registre a instância no `ProviderRegistry`. A rota HTTP, o repositório e o `IntentService` continuam consumindo apenas `NormalizedEvent[]`.
