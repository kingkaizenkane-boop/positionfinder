CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  source_name TEXT,
  source_year INTEGER,
  raw_text TEXT NOT NULL,
  games_detected INTEGER NOT NULL DEFAULT 0,
  draws_detected INTEGER NOT NULL DEFAULT 0,
  draws_imported INTEGER NOT NULL DEFAULT 0,
  draws_rejected INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO anon;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can manage import batches" ON public.import_batches FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX import_batches_created_at_idx ON public.import_batches (created_at DESC);