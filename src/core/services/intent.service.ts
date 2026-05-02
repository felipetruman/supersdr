import type { IntentClassifier, IntentResult } from '../ports/intent-classifier.js';
import type { IntentRepository } from '../repositories/intent-repository.js';

export type IntentLogger = {
  info: (...a: unknown[]) => void;
  error: (...a: unknown[]) => void;
};

export class IntentService {
  constructor(
    private readonly classifier: IntentClassifier,
    private readonly repo: IntentRepository,
    private readonly logger: IntentLogger = console,
  ) {}

  async classifyAndStore(
    messageEventId: string,
    text: string,
    language?: string,
  ): Promise<IntentResult> {
    const result = await this.classifier.classify(text, { language });
    await this.repo.saveIntent(messageEventId, result);
    return result;
  }

  /**
   * Fire-and-forget: usa em hot-paths (webhook) pra não atrasar ACK.
   * Erros são logados, nunca propagam.
   */
  classifyInBackground(messageEventId: string, text: string, language?: string): void {
    this.classifyAndStore(messageEventId, text, language).catch((err) => {
      this.logger.error(
        `[intent] classify failed for event=${messageEventId}: ${(err as Error).message}`,
      );
    });
  }
}
