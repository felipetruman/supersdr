import { afterEach, describe, expect, it, vi } from 'vitest';

const endMock = vi.fn();
const postgresMock = vi.fn(() => ({ end: endMock }));

vi.mock('postgres', () => ({
  default: postgresMock,
}));

describe('db connection', () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('creates db with defaults and caches getDb', async () => {
    process.env.DATABASE_URL = 'postgres://test';
    const mod = await import('../../db/connection.js');

    const db = mod.createDb({ url: 'postgres://custom', max: 3, idleTimeout: 7 });
    expect(db).toBeTruthy();
    expect(postgresMock).toHaveBeenCalledWith(
      'postgres://custom',
      expect.objectContaining({ max: 3, idle_timeout: 7 }),
    );

    const got = mod.getDb();
    expect(got).toBeTruthy();

    await mod.closeDb();
    expect(endMock).toHaveBeenCalledWith({ timeout: 5 });
  });

  it('throws when DATABASE_URL is missing', async () => {
    const mod = await import('../../db/connection.js');
    expect(() => mod.getDb()).toThrow('DATABASE_URL not set');
  });
});
