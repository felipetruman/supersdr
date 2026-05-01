import type {
  IntentClassifier,
  IntentLabel,
  IntentResult,
} from '../../core/ports/intent-classifier.js';

/**
 * Mock classifier — heurística por palavras-chave (PT-BR + EN).
 * Default em dev/CI. Não requer chave de API.
 */
export class MockIntentClassifier implements IntentClassifier {
  readonly providerName = 'mock';

  async classify(text: string): Promise<IntentResult> {
    const t = text.toLowerCase().trim();

    const matchers: Array<{ intent: IntentLabel; patterns: RegExp[]; conf: number }> = [
      {
        intent: 'greeting',
        conf: 0.9,
        patterns: [
          /\b(oi|ol[aá]|bom dia|boa tarde|boa noite|e a[ií]|hey|hi|hello)\b/,
        ],
      },
      {
        intent: 'goodbye',
        conf: 0.9,
        patterns: [
          /\b(tchau|at[eé] (mais|logo|breve)|valeu|flw|bye|goodbye|see ya)\b/,
        ],
      },
      {
        intent: 'complaint',
        conf: 0.85,
        patterns: [
          /\b(reclama[cç][aã]o|p[eé]ssimo|horr[ií]vel|n[aã]o funciona|bug|problema grave|inaceit[aá]vel|terrible|awful|broken)\b/,
        ],
      },
      {
        intent: 'compliment',
        conf: 0.85,
        patterns: [
          /\b(parab[eé]ns|excelente|[oó]timo|maravilhos[oa]|adorei|amei|top|incr[ií]vel|awesome|great job|love it)\b/,
        ],
      },
      {
        intent: 'sales_inquiry',
        conf: 0.8,
        patterns: [
          /\b(pre[cç]o|valor|quanto custa|plano|or[cç]amento|comprar|contratar|how much|pricing|buy|purchase)\b/,
        ],
      },
      {
        intent: 'support_request',
        conf: 0.8,
        patterns: [
          /\b(ajuda|suporte|d[uú]vida|como (fa[cç]o|funciona)|n[aã]o consigo|erro|help|support|issue|how do i)\b/,
        ],
      },
    ];

    for (const m of matchers) {
      if (m.patterns.some((rx) => rx.test(t))) {
        return {
          intent: m.intent,
          confidence: m.conf,
          provider: this.providerName,
        };
      }
    }

    return {
      intent: 'other',
      confidence: 0.3,
      provider: this.providerName,
    };
  }
}
