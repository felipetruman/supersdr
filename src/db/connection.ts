import postgres, { type Sql } from 'postgres';

let _sql: Sql | null = null;

export interface DbConfig {
  url: string;
  max?: number;
  idleTimeout?: number;
}

export function createDb(config: DbConfig): Sql {
  return postgres(config.url, {
    max: config.max ?? 10,
    idle_timeout: config.idleTimeout ?? 20,
    onnotice: () => {}, // silencia NOTICEs em dev
  });
}

export function getDb(): Sql {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL not set');
    }
    _sql = createDb({ url });
  }
  return _sql;
}

export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
  }
}
