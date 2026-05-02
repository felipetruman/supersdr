import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleClassifier } from '../../../adapters/intent/openai-compat.classifier.js';

describe('OpenAICompatibleClassifier', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('normalizes parsed intent and confidence', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"intent":"Greeting","confidence":1.2345}' } }],
      }),
    } as never);

    const classifier = new OpenAICompatibleClassifier({
      providerName: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'k',
      model: 'm',
      timeoutMs: 1,
    });

    const result = await classifier.classify('oi', { language: 'en' });

    expect(result.intent).toBe('greeting');
    expect(result.confidence).toBe(1);
    expect(result.provider).toBe('openai');
    expect(result.raw).toEqual({ intent: 'Greeting', confidence: 1.2345 });
  });

  it('extracts json from noisy content and clamps invalid confidence', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'noise {"intent":"x","confidence":-2} tail' } }],
      }),
    } as never);

    const classifier = new OpenAICompatibleClassifier({
      providerName: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'k',
      model: 'm',
    });

    const result = await classifier.classify('oi');

    expect(result.intent).toBe('other');
    expect(result.confidence).toBe(0);
  });

  it('throws when upstream returns non-ok', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'boom',
    } as never);

    const classifier = new OpenAICompatibleClassifier({
      providerName: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'k',
      model: 'm',
    });

    await expect(classifier.classify('oi')).rejects.toThrow('LLM HTTP 500: boom');
  });
});
