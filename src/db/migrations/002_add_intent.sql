-- 002_add_intent.sql
-- Adiciona colunas de classificação de intenção (LLM) à tabela message_events.
-- confidence: NUMERIC(4,3) com CHECK 0..1 (alinhado com clamp01 do classifier).

ALTER TABLE message_events
  ADD COLUMN IF NOT EXISTS intent              TEXT,
  ADD COLUMN IF NOT EXISTS intent_confidence   NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS intent_provider     TEXT,
  ADD COLUMN IF NOT EXISTS intent_model        TEXT,
  ADD COLUMN IF NOT EXISTS intent_classified_at TIMESTAMPTZ;

-- CHECK semântico: confidence sempre entre 0 e 1 (NULL permitido = não classificado)
DO $$
BEGIN IF NOT EXISTS ( SELECT 1 FROM pg_constraint WHERE conname = 'message_events_intent_confidence_range' ) THEN ALTER TABLE message_events ADD CONSTRAINT message_events_intent_confidence_range CHECK (intent_confidence IS NULL OR (intent_confidence >= 0 AND intent_confidence <= 1)); END IF; END
$$;

CREATE INDEX IF NOT EXISTS idx_message_events_intent
  ON message_events (intent)
  WHERE intent IS NOT NULL;
