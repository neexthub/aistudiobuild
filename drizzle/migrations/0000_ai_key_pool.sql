CREATE TABLE IF NOT EXISTS public.published_apps (slug text PRIMARY KEY, name text NOT NULL, html text NOT NULL, owner_key text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT (slug, name, html, updated_at) ON public.published_apps TO anon, authenticated;
GRANT ALL ON public.published_apps TO service_role;
ALTER TABLE public.published_apps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read published" ON public.published_apps;
CREATE POLICY "public read published" ON public.published_apps FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.ai_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  api_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  cooldown_until timestamptz,
  fail_count int NOT NULL DEFAULT 0,
  use_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_keys TO service_role;
ALTER TABLE public.ai_keys ENABLE ROW LEVEL SECURITY;