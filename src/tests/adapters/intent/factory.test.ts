import { describe, expect, it } from 'vitest';
import { createIntentClassifier } from '../../../adapters/intent/factory.js';

describe('createIntentClassifier', () => {
  it('returns mock by default and when classifier is mock', () => {
    expect(createIntentClassifier({} as never).providerName).toBe('mock');
    expect(createIntentClassifier({ INTENT_CLASSIFIER: 'mock' }).providerName).toBe('mock');
  });

  it('falls back to mock when api key is missing for non-ollama providers', () => {
    expect(createIntentClassifier({ INTENT_CLASSIFIER: 'openai' }).providerName).toBe('mock');
  });

  it('uses defaults for openai provider', () => {
    const classifier = createIntentClassifier({
      INTENT_CLASSIFIER: 'openai',
      INTENT_API_KEY: 'k',
    });

    expect(classifier.providerName).toBe('openai');
  });

  it('accepts custom config and ollama without api key', () => {
    const classifier = createIntentClassifier({
      INTENT_CLASSIFIER: 'ollama',
      INTENT_BASE_URL: 'http://localhost:11434/v1',
    });

    expect(classifier.providerName).toBe('ollama');
  });

  it('throws when base url is missing for custom provider', () => {
    expect(() =>
      createIntentClassifier({
        INTENT_CLASSIFIER: 'custom',
        INTENT_API_KEY: 'k',
      }),
    ).toThrow('INTENT_BASE_URL é obrigatório');
  });
});
