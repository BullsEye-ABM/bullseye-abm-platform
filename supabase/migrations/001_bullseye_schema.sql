-- ═══════════════════════════════════════════════════════════════════════════════
-- BullsEye ABM Platform · Schema inicial
-- Ejecutar en Supabase SQL Editor del MISMO proyecto que prospector-app
--
-- IMPORTANTE: este script NO toca las tablas existentes del prospector-app
-- (clients, app_users, app_sessions, prospect_runs, usage_log).
-- Solo agrega 1 columna a `clients` y crea tablas nuevas con prefijo `bullseye_`.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Agregar columna para Lemlist API key encriptada en la tabla `clients` existente
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS bullseye_lemlist_api_key_encrypted TEXT;

COMMENT ON COLUMN clients.bullseye_lemlist_api_key_encrypted IS
  'Lemlist API key cifrada (AES-256) para campañas BullsEye. Solo el backend desencripta.';

-- 2. Tabla bullseye_campaigns
CREATE TABLE IF NOT EXISTS bullseye_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  goal            TEXT,
  industry        TEXT,
  role            TEXT,
  channels        TEXT[] NOT NULL DEFAULT ARRAY['linkedin','email'],
  msgs_per_channel JSONB NOT NULL DEFAULT '{"linkedin":1,"email":1,"whatsapp":1}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bullseye_campaigns_client ON bullseye_campaigns(client_id);

-- 3. Tabla bullseye_segments
CREATE TABLE IF NOT EXISTS bullseye_segments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES bullseye_campaigns(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  criteria          TEXT,
  contact_count     INT NOT NULL DEFAULT 0,
  approved_count    INT NOT NULL DEFAULT 0,
  prospector_run_id UUID,  -- FK opcional a prospect_runs.id si vino del prospector
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bullseye_segments_campaign ON bullseye_segments(campaign_id);

-- 4. Tabla bullseye_contacts
CREATE TABLE IF NOT EXISTS bullseye_contacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id            UUID NOT NULL REFERENCES bullseye_segments(id) ON DELETE CASCADE,
  name                  TEXT,
  title                 TEXT,
  company               TEXT,
  email                 TEXT,
  country               TEXT,
  decision_maker        TEXT,
  linkedin              TEXT,
  website               TEXT,
  phone                 TEXT,
  prospector_contact_id UUID,  -- referencia opcional al contacto original del prospector
  extra                 JSONB DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bullseye_contacts_segment ON bullseye_contacts(segment_id);
CREATE INDEX IF NOT EXISTS idx_bullseye_contacts_email ON bullseye_contacts(email);

-- 5. Tabla bullseye_messages
CREATE TABLE IF NOT EXISTS bullseye_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID NOT NULL REFERENCES bullseye_contacts(id) ON DELETE CASCADE,
  segment_id    UUID NOT NULL REFERENCES bullseye_segments(id) ON DELETE CASCADE,
  approved      BOOLEAN NOT NULL DEFAULT FALSE,
  linkedin      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  email         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- {subject, body}[]
  whatsapp      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  sources       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- {query,url}[]
  generated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contact_id)  -- 1 mensaje por contacto
);
CREATE INDEX IF NOT EXISTS idx_bullseye_messages_segment ON bullseye_messages(segment_id);
CREATE INDEX IF NOT EXISTS idx_bullseye_messages_approved ON bullseye_messages(approved);

-- 6. Tabla bullseye_personas (1 persona por segmento)
CREATE TABLE IF NOT EXISTS bullseye_personas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id  UUID NOT NULL UNIQUE REFERENCES bullseye_segments(id) ON DELETE CASCADE,
  name        TEXT,
  title       TEXT,
  summary     TEXT,
  pains       JSONB DEFAULT '[]'::jsonb,
  motivations JSONB DEFAULT '[]'::jsonb,
  objections  JSONB DEFAULT '[]'::jsonb,
  kpis        JSONB DEFAULT '[]'::jsonb,
  channels    JSONB DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tabla bullseye_directives (1 directrices por segmento)
CREATE TABLE IF NOT EXISTS bullseye_directives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id  UUID NOT NULL UNIQUE REFERENCES bullseye_segments(id) ON DELETE CASCADE,
  text        TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Tabla bullseye_sources (URL/PDF/text por cliente)
CREATE TABLE IF NOT EXISTS bullseye_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('url','pdf','text')),
  name          TEXT NOT NULL,
  url           TEXT,
  content       TEXT,            -- texto plano (para type='text')
  storage_path  TEXT,             -- ruta en Supabase Storage (para type='pdf')
  size          BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bullseye_sources_client ON bullseye_sources(client_id);

-- 9. Triggers para updated_at automático
CREATE OR REPLACE FUNCTION bullseye_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'bullseye_campaigns','bullseye_segments','bullseye_messages',
    'bullseye_personas','bullseye_directives'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated ON %s;
       CREATE TRIGGER trg_%s_updated
         BEFORE UPDATE ON %s
         FOR EACH ROW EXECUTE FUNCTION bullseye_set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;

-- 10. Row Level Security (políticas básicas — refinar cuando haya auth multi-tenant)
ALTER TABLE bullseye_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bullseye_segments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bullseye_contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bullseye_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bullseye_personas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bullseye_directives ENABLE ROW LEVEL SECURITY;
ALTER TABLE bullseye_sources    ENABLE ROW LEVEL SECURITY;

-- Por ahora: solo authenticated users pueden leer/escribir.
-- Cuando integremos con app_users del prospector haremos políticas finas.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'bullseye_campaigns','bullseye_segments','bullseye_contacts',
    'bullseye_messages','bullseye_personas','bullseye_directives','bullseye_sources'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "%s_authenticated_all" ON %s;
       CREATE POLICY "%s_authenticated_all" ON %s
         FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      t, t, t, t
    );
  END LOOP;
END $$;

-- Listo
SELECT 'BullsEye schema instalado ✅' AS status;
