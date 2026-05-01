import type {
  IntentClassifier,
  IntentLabel,
  IntentResult,
} from '../../core/ports/intent-classifier.js';
import { INTENT_LABELS } from '../../core/ports/intent-classifier.js';

export interface OpenAICompatConfig {
  providerName: string;   // "groq" | "openai" | "gemini" | "ollama" | ...
  baseUrl: string;        // ex: https://api.groq.com/openai/v1
  apiKey: string;
  model: string;          // ex: llama-3.1-8b-instant
  timeoutMs?: number;
}

/**
 * Classifier baseado em endpoint OpenAI-compatible /chat/completions.
 * Funciona com:
 *  - Groq        → https://api.groq.com/openai/v1
 *  - OpenAI      → https://api.openai.com/v1
 *  - Gemini      → https://generativelanguage.googleapis.com/v1beta/openai
 *  - Ollama      → http://localhost:11434/v1
 *  - OpenRouter  → https://openrouter.ai/api/v1
 */
export class OpenAICompatibleClassifier implements IntentClassifier {
  readonly providerName: string;
  private readonly cfg: OpenAICompatConfig;

  constructor(cfg: OpenAICompatConfig) {
    this.cfg = cfg;
    this.providerName = cfg.providerName;
  }

  async classify(text: string, opts?: { language?: string }): Promise<IntentResult> {
    const lang = opts?.language ?? 'pt-BR';
    const allowed = INTENT_LABELS.join(', ');

    const system = [
      'You are an intent classifier for a customer-service WhatsApp SaaS.',
      `Reply ONLY with a strict JSON object: {"intent": "<one_of>", "confidence": <0..1>}.`,
      `Allowed intents: ${allowed}.`,
      `User language: ${lang}. Do not output anything else.`,
    ].join(' ');

    const body = {
      model: this.cfg.model,
      temperature: 0,
      response_format: { type: 'json_object' as const },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 8000);

    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content ?? '';
    const parsed = safeJson(content);

    const intent = normalizeIntent(parsed?.intent);
    const confidence = clamp01(Number(parsed?.confidence ?? 0.5));

    return {
      intent,
      confidence,
      provider: this.providerName,
      model: this.cfg.model,
      raw: parsed,
    };
  }
}

function safeJson(s: string): { intent?: unknown; confidence?: unknown } | null {
  try {
    return JSON.parse(s);
  } catch {
    // tenta extrair primeiro { ... }
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

function normalizeIntent(v: unknown): IntentLabel {
  const s = String(v ?? '').toLowerCase().trim();
  return (INTENT_LABELS as readonly string[]).includes(s)
    ? (s as IntentLabel)
    : 'other';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Number(n.toFixed(3));
}
