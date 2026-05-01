-- ============================================================
-- SuperSDR — schema inicial
-- Idempotência via UNIQUE composto (provider, instance_id, provider_message_id)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Eventos brutos + normalizados
CREATE TABLE IF NOT EXISTS message_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              TEXT NOT NULL,
  instance_id           TEXT NOT NULL,
  provider_message_id   TEXT NOT NULL,
  kind                  TEXT NOT NULL CHECK (kind IN ('message', 'status')),

  -- Mensagem (kind='message')
  direction             TEXT,
  message_type          TEXT,
  from_phone            TEXT,
  from_name             TEXT,
  to_phone              TEXT,
  to_name               TEXT,
  text_content          TEXT,
  reply_to_message_id   TEXT,

  -- Status (kind='status')
  status                TEXT,
  error_reason          TEXT,

  -- Comum
  event_timestamp       TIMESTAMPTZ NOT NULL,
  normalized            JSONB NOT NULL,
  raw_payload           JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT message_events_unique
    UNIQUE (provider, instance_id, provider_message_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_message_events_provider_instance
  ON message_events (provider, instance_id, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_message_events_from_phone
  ON message_events (from_phone)
  WHERE from_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_events_created_at
  ON message_events (created_at DESC);
