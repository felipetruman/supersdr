# Prova Técnica – Sistema de Normalização de Webhooks

## 1\. Introdução

### Sobre este desafio

Este desafio tem como objetivo avaliar suas habilidades em **design de arquitetura, implementação de código TypeScript e integração com APIs externas**. Queremos entender como você estrutura soluções escaláveis, toma decisões técnicas e resolve problemas de integração com múltiplos formatos de dados.

**Importante:** Não existe uma única solução correta. Valorizamos clareza, pragmatismo e a capacidade de justificar suas decisões técnicas.
* * *

## 2\. O Desafio

### Sistema de Normalização de Webhooks - SuperSDR

Você deve desenvolver a **arquitetura e implementação de um sistema de recebimento e normalização de mensagens** de múltiplos provedores de WhatsApp.

### Contexto de Negócio

O SuperSDR é um sistema de automação de atendimento via WhatsApp que utiliza IA para qualificação de leads. O sistema precisa se integrar com diversas plataformas de WhatsApp (provedores), cada uma com seu próprio formato de webhook e estrutura de dados.

**O problema:** Cada provedor envia webhooks com formatos completamente diferentes, mas no final todos representam a mesma coisa — uma mensagem recebida.

### Exemplos de Provedores

Os provedores abaixo são alguns dos mais utilizados no mercado brasileiro. Você pode usar estes como referência:

*   API Oficial Meta (Cloud API)
*   Evolution API
*   Z-API

O sistema deve permitir:

*   Receber webhooks de múltiplos provedores
*   Normalizar os dados para um formato único interno
*   Adicionar novos provedores com facilidade
*   Ser resiliente a falhas
* * *

## 3\. Requisitos Funcionais

### Parte 1: Sistema de Recebimento (Obrigatório)

#### 1.1 Estrutura Geral

Descreva a organização dos componentes do sistema:

*   Quais camadas/módulos existiriam
*   Qual a responsabilidade de cada um
*   Como se comunicam

#### 1.2 Implementação em Código

Implemente a solução proposta em TypeScript. O código deve:

*   Ser funcional (pode rodar)
*   Demonstrar o pattern escolhido
*   Incluir pelo menos 2 provedores implementados
*   Mostrar como os dados são normalizados para um formato único

#### 1.3 Justificativa do Pattern

Explique qual pattern você escolheu e por quê. Justifique como ele resolve o problema de múltiplos formatos de entrada.

#### 1.4 Extensibilidade

Demonstre (no código ou em texto) como adicionar um novo provedor seria simples e não exigiria alterações no código existente.

#### 1.5 Tratamento de Erros

Mostre no código como você lidaria com:

*   Webhook malformado
*   Provedor desconhecido
*   Falha no processamento

### Parte 2: Habilidades Complementares (Obrigatório)

#### 2.1 Banco de Dados

Proponha um schema simples para armazenar as mensagens normalizadas. Pode ser:

*   SQL (PostgreSQL preferencial)
*   Diagrama ER
*   Código de migration

**Objetivo:** Avaliar se você sabe modelar dados.

#### 2.2 Integração com LLM

Descreva (ou implemente) como você integraria uma LLM (ex: OpenAI, Claude) para:

*   Classificar a intenção da mensagem recebida
*   Ou gerar uma resposta automática

**Objetivo:** Avaliar experiência com IA. Não precisa implementar completo.
* * *

## 4\. Requisitos Técnicos Obrigatórios

### Stack Tecnológica

| Camada | Requisito |
| ---| --- |
| Linguagem | TypeScript |
| Runtime | Node.js ou Deno |
| Banco de Dados | PostgreSQL (preferencial) ou outro relacional |
| Versionamento | Git + GitHub |

**Sugestão de deploy:** Supabase Edge Functions é uma ótima opção para este desafio. Você pode usar o plano gratuito e já terá PostgreSQL integrado. Mas sinta-se livre para usar outra plataforma se preferir.

### Boas Práticas

*   Código organizado e legível
*   Commits frequentes com mensagens descritivas
*   Tratamento básico de erros
*   Variáveis de ambiente para chaves sensíveis

### Recursos para Teste

| Provedor | Recurso |
| ---| --- |
| Z-API | [https://z-api.io](https://z-api.io) - Conta gratuita para testes |
| Evolution API | [https://evolution-api.com](https://evolution-api.com) - Open source, pode subir local |
| Meta Cloud API | Requer conta business (pode simular payload) |
| Simulação | Postman ou Insomnia para enviar payloads de teste |

* * *

## 5\. Payloads de Referência

Os payloads abaixo são **exemplos simplificados** para você ter uma referência inicial.

**Para simulação via Postman/Insomnia:** Os exemplos abaixo são suficientes. Não precisam ser exatamente iguais aos payloads reais das plataformas — o importante é demonstrar que seu sistema consegue lidar com formatos diferentes.

**Para implementação real com provedores:** Se optar por testar com Z-API, Evolution API ou outro provedor real, consulte a documentação oficial para obter a estrutura completa e atualizada dos webhooks.

### Exemplo: Webhook da Meta (Cloud API)

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "5511999999999",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "João Silva" },
          "wa_id": "5511988888888"
        }],
        "messages": [{
          "from": "5511988888888",
          "id": "wamid.HBgNNTUxMTk5OTk5OTk5ORUCABIYFjNFQjBCNkU3",
          "timestamp": "1677234567",
          "type": "text",
          "text": { "body": "Olá, gostaria de saber mais sobre o produto" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Exemplo: Webhook Evolution API

```json
{
  "event": "messages.upsert",
  "instance": "minha-instancia",
  "data": {
    "key": {
      "remoteJid": "5511988888888@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0B430B6F8C1D073A0"
    },
    "pushName": "João Silva",
    "message": {
      "conversation": "Olá, gostaria de saber mais sobre o produto"
    },
    "messageType": "conversation",
    "messageTimestamp": 1677234567
  },
  "destination": "5511999999999@s.whatsapp.net",
  "date_time": "2024-01-15T10:30:00.000Z",
  "sender": "5511988888888@s.whatsapp.net",
  "server_url": "https://sua-evolution-api.com",
  "apikey": "sua-api-key"
}
```

### Exemplo: Webhook Z-API

```json
{
  "instanceId": "SUA_INSTANCE_ID",
  "messageId": "3EB0B430B6F8C1D073A0",
  "phone": "5511988888888",
  "fromMe": false,
  "momment": 1677234567000,
  "status": "RECEIVED",
  "chatName": "João Silva",
  "senderPhoto": "https://pps.whatsapp.net/...",
  "senderName": "João Silva",
  "participantPhone": null,
  "photo": "https://pps.whatsapp.net/...",
  "broadcast": false,
  "type": "ReceivedCallback",
  "text": {
    "message": "Olá, gostaria de saber mais sobre o produto"
  }
}
```

* * *

## 6\. Requisitos Diferenciais (Não Obrigatórios)

Os itens abaixo não são obrigatórios, mas serão considerados positivamente:

- [ ] **Fluxo Visual:** Diagrama do fluxo de processamento (desde a chegada do webhook até o dado normalizado)
- [ ] **Testes Unitários:** Cobertura básica de testes
- [ ] **Teste com Provedor Real:** Usar Z-API ou Evolution API para validar sua implementação
- [ ] **Implementação Completa de LLM:** Integração funcional com OpenAI/Claude para classificação ou resposta
* * *

## 7\. Entregáveis

### 1\. Repositório GitHub

*   Crie um repositório **público** no seu GitHub
*   Nome sugerido: `supersdr-prova-tecnica` ou similar
*   Código organizado e commits com mensagens claras

### 2\. Documentação

O README deve conter:

*   **Descrição do projeto:** breve explicação do que foi desenvolvido
*   **Como rodar o projeto:** instruções de setup e execução
*   **Tecnologias utilizadas:** lista de ferramentas, frameworks e serviços
*   **Decisões técnicas:** explicação das principais escolhas, incluindo:
    *   Pattern utilizado e justificativa
    *   Estrutura de banco de dados
    *   Como a extensibilidade foi garantida
    *   Desafios encontrados e como resolveu
*   **Funcionalidades implementadas:** checklist do que foi entregue

### 3\. Código Funcional

*   A implementação deve rodar
*   Não precisa estar em produção, mas deve ser testável localmente

### 4\. Vídeo de Apresentação (Obrigatório)

*   Vídeo de **até 10 minutos** demonstrando:
    *   Visão geral da solução
    *   Fluxo de recebimento e normalização
    *   Decisões técnicas relevantes
    *   Diferenciais implementados (se houver)
*   Pode Google Drive ou YouTube (público)
*   Envie o link junto com o repositório
* * *

## 8\. Sobre Uso de IA

**Pode usar IA** (Claude, ChatGPT, Copilot, etc) para ajudar.

Não estamos avaliando se você faz tudo "na mão". Queremos ver:

*   Se você sabe usar IA como ferramenta de produtividade
*   Se você entende o código que a IA gera
*   Se você sabe revisar, ajustar e melhorar o output

**Se usar IA, mencione no README como ela te ajudou. Isso é um ponto positivo, não negativo.**
* * *

## 9\. Critérios de Avaliação

| Critério | O que avaliamos |
| ---| --- |
| Código funcional | A implementação roda e faz o que propõe? |
| Clareza | A solução é fácil de entender? |
| Extensibilidade | É fácil adicionar novos provedores? |
| Separação de responsabilidades | Cada componente tem uma função clara? |
| Resiliência | O sistema lida bem com erros? |
| Pragmatismo | A solução é implementável ou é over-engineering? |
| GitHub | Repositório bem organizado, commits claros, README útil |
| Banco de dados | Schema faz sentido para o problema |
| IA | Demonstra experiência ou capacidade de aprender |
| Vídeo | Comunicação clara, demonstração eficaz |

* * *

## 10\. Dicas e Recomendações

1. **Não existe resposta "certa"** — queremos ver seu raciocínio
2. **Se fizer suposições, deixe-as explícitas** no README
3. **Menos é mais:** uma solução simples e bem justificada vale mais que uma complexa sem explicação
4. **O código não precisa ser perfeito,** mas precisa demonstrar o pattern escolhido
5. **Use os recursos gratuitos** (Z-API, Evolution) para testar se quiser impressionar
6. **Commits frequentes:** faça commits com mensagens claras. Queremos ver a evolução do projeto

**Boa sorte! Estamos ansiosos para ver sua solução.** 🚀