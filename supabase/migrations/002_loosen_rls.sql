-- ═══════════════════════════════════════════════════════════════════════════════
-- 002 · Aflojar RLS para que anon pueda leer/escribir
--
-- Razón: la app usa la anon key sin Supabase Auth (igual que prospector-app).
-- Mientras no haya auth a nivel Supabase, anon es el único rol que aplica.
-- Cuando integremos auth (compartida con prospector-app vía app_users) reforzaremos.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'bullseye_campaigns','bullseye_segments','bullseye_contacts',
    'bullseye_messages','bullseye_personas','bullseye_directives','bullseye_sources'
  ])
  LOOP
    -- Drop la policy vieja
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_all" ON %s;', t, t);

    -- Crear policy abierta a anon + authenticated
    EXECUTE format(
      'CREATE POLICY "%s_open_all" ON %s
         FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      t, t
    );
  END LOOP;
END $$;

SELECT 'RLS aflojado ✅' AS status;
