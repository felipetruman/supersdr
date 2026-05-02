/**
 * Port: Intent Classifier
 * --------------------------------------------------
 * Contrato pra classificadores de intenção (LLM ou rule-based).
 * Implementações concretas ficam em src/adapters/intent/*.
 */

export const INTENT_LABELS = [
  'greeting',
  'support_request',
  'sales_inquiry',
  'complaint',
  'compliment',
  'goodbye',
  'other',
] as const;

export type IntentLabel = (typeof INTENT_LABELS)[number];

export interface IntentResult {
  intent: IntentLabel;
  confidence: number; // 0..1
  provider: string;   // "mock" | "groq" | "openai" | "gemini" | "ollama" | ...
  model?: string;
  raw?: unknown;      // resposta crua do LLM (debug)
}

export interface IntentClassifier {
  readonly providerName: string;
  classify(text: string, opts?: { language?: string }): Promise<IntentResult>;
}
