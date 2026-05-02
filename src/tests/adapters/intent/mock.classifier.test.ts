import { describe, it, expect } from 'vitest';
import { MockIntentClassifier } from '../../../adapters/intent/mock.classifier.js';

describe('MockIntentClassifier', () => {
  const c = new MockIntentClassifier();

  it('detects greeting (pt-BR)', async () => {
    const r = await c.classify('Olá, bom dia!');
    expect(r.intent).toBe('greeting');
    expect(r.confidence).toBeGreaterThan(0.8);
    expect(r.provider).toBe('mock');
  });

  it('detects greeting (en)', async () => {
    const r = await c.classify('Hi there');
    expect(r.intent).toBe('greeting');
  });

  it('detects goodbye', async () => {
    const r = await c.classify('Tchau, valeu!');
    expect(r.intent).toBe('goodbye');
  });

  it('detects sales_inquiry', async () => {
    const r = await c.classify('Quanto custa o plano premium?');
    expect(r.intent).toBe('sales_inquiry');
  });

  it('detects support_request', async () => {
    const r = await c.classify('Preciso de ajuda, não consigo logar');
    expect(r.intent).toBe('support_request');
  });

  it('detects complaint', async () => {
    const r = await c.classify('Péssimo atendimento, inaceitável');
    expect(r.intent).toBe('complaint');
  });

  it('detects compliment', async () => {
    const r = await c.classify('Excelente! Adorei o serviço');
    expect(r.intent).toBe('compliment');
  });

  it('falls back to "other" when no match', async () => {
    const r = await c.classify('xyz qwerty 123');
    expect(r.intent).toBe('other');
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('confidence is always within [0,1]', async () => {
    const samples = ['oi', 'tchau', 'preço', 'erro', 'top', 'reclamação', 'random'];
    for (const s of samples) {
      const r = await c.classify(s);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
});
