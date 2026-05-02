import type { IntentClassifier } from '../../core/ports/intent-classifier.js';
import { MockIntentClassifier } from './mock.classifier.js';
import { OpenAICompatibleClassifier } from './openai-compat.classifier.js';

export type IntentProviderName = 'mock' | 'groq' | 'openai' | 'gemini' | 'ollama' | 'openrouter' | 'custom';

const DEFAULT_BASE_URLS: Record<Exclude<IntentProviderName, 'mock' | 'custom'>, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  ollama: 'http://localhost:11434/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

const DEFAULT_MODELS: Record<Exclude<IntentProviderName, 'mock' | 'custom'>, string> = {
  groq: 'llama-3.1-8b-instant',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
  ollama: 'llama3.1',
  openrouter: 'meta-llama/llama-3.1-8b-instruct',
};

export interface IntentFactoryEnv {
  INTENT_CLASSIFIER?: string;
  INTENT_API_KEY?: string;
  INTENT_BASE_URL?: string;
  INTENT_MODEL?: string;
  INTENT_TIMEOUT_MS?: string;
}

export function createIntentClassifier(env: IntentFactoryEnv = process.env): IntentClassifier {
  const name = (env.INTENT_CLASSIFIER ?? 'mock').toLowerCase() as IntentProviderName;

  if (name === 'mock') return new MockIntentClassifier();

  const apiKey = env.INTENT_API_KEY ?? '';
  if (!apiKey && name !== 'ollama') {
    // sem chave → cai no mock pra não quebrar dev/CI
    return new MockIntentClassifier();
  }

  const baseUrl =
    env.INTENT_BASE_URL ??
    (name in DEFAULT_BASE_URLS ? DEFAULT_BASE_URLS[name as keyof typeof DEFAULT_BASE_URLS] : '');

  const model =
    env.INTENT_MODEL ??
    (name in DEFAULT_MODELS ? DEFAULT_MODELS[name as keyof typeof DEFAULT_MODELS] : 'gpt-4o-mini');

  if (!baseUrl) {
    throw new Error(`INTENT_BASE_URL é obrigatório para provider="${name}"`);
  }

  return new OpenAICompatibleClassifier({
    providerName: name,
    baseUrl,
    apiKey: apiKey || 'ollama',
    model,
    timeoutMs: env.INTENT_TIMEOUT_MS ? Number(env.INTENT_TIMEOUT_MS) : 8000,
  });
}
