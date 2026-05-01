import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, getDb } from './connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const dir = join(__dirname, 'migrations');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM _migrations WHERE name = ${file}
    `;
    if (Number(count) > 0) {
      console.log(`⏭️  ${file} (já aplicada)`);
      continue;
    }

    const content = await readFile(join(dir, file), 'utf8');
    console.log(`▶️  Aplicando ${file}...`);
    await sql.unsafe(content);
    await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    console.log(`✅ ${file}`);
  }

  await closeDb();
  console.log('🎉 Migrations OK');
}

migrate().catch(async (err) => {
  console.error('❌ Migration failed:', err);
  await closeDb();
  process.exit(1);
});
