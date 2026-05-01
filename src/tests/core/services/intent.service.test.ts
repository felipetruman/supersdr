import { describe, it, expect, vi } from 'vitest';
import { IntentService } from '../../../core/services/intent.service.js';
import { MockIntentClassifier } from '../../../adapters/intent/mock.classifier.js';
import { InMemoryIntentRepository } from '../../../db/repositories/in-memory-intent.repository.js';

describe('IntentService', () => {
  it('classifyAndStore: classifica e persiste no repo', async () => {
    const repo = new InMemoryIntentRepository();
    const svc = new IntentService(new MockIntentClassifier(), repo);

    const result = await svc.classifyAndStore('evt-1', 'Bom dia!');

    expect(result.intent).toBe('greeting');
    expect(repo.get('evt-1')?.result.intent).toBe('greeting');
    expect(repo.snapshot()).toHaveLength(1);
  });

  it('classifyInBackground: não bloqueia e propaga ao repo', async () => {
    const repo = new InMemoryIntentRepository();
    const svc = new IntentService(new MockIntentClassifier(), repo);

    svc.classifyInBackground('evt-2', 'Excelente!');
    // espera microtask resolver
    await new Promise((r) => setImmediate(r));

    expect(repo.get('evt-2')?.result.intent).toBe('compliment');
  });

  it('classifyInBackground: loga erro e não propaga exceção', async () => {
    const failingClassifier = {
      providerName: 'broken',
      classify: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const repo = new InMemoryIntentRepository();
    const errors: string[] = [];
    const logger = {
      info: () => {},
      error: (msg: unknown) => errors.push(String(msg)),
    };

    const svc = new IntentService(failingClassifier, repo, logger);
    expect(() => svc.classifyInBackground('evt-3', 'oi')).not.toThrow();

    await new Promise((r) => setImmediate(r));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('evt-3');
    expect(errors[0]).toContain('boom');
    expect(repo.snapshot()).toHaveLength(0);
  });

  it('reclassifying same id sobrescreve o resultado anterior', async () => {
    const repo = new InMemoryIntentRepository();
    const svc = new IntentService(new MockIntentClassifier(), repo);

    await svc.classifyAndStore('evt-4', 'oi');
    await svc.classifyAndStore('evt-4', 'preço');

    expect(repo.get('evt-4')?.result.intent).toBe('sales_inquiry');
    expect(repo.snapshot()).toHaveLength(1);
  });
});
