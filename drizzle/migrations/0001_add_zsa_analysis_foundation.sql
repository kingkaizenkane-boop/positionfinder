CREATE TABLE public.zsa_source_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  game_name TEXT NOT NULL,
  source_order INTEGER NOT NULL,
  source_line_start INTEGER NOT NULL,
  source_line_end INTEGER NOT NULL,
  source_text TEXT NOT NULL,
  draw_number INTEGER,
  draw_date DATE,
  line_role SMALLINT CHECK (line_role BETWEEN 1 AND 3),
  position_values SMALLINT[],
  record_status TEXT NOT NULL DEFAULT 'requires_review' CHECK (record_status IN ('valid', 'invalid', 'duplicate', 'incomplete', 'requires_review')),
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, source_order)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zsa_source_occurrences TO anon, authenticated;
GRANT ALL ON public.zsa_source_occurrences TO service_role;
ALTER TABLE public.zsa_source_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared testing access" ON public.zsa_source_occurrences FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX zsa_source_occurrences_game_source_idx ON public.zsa_source_occurrences (game_id, source_order);
CREATE INDEX zsa_source_occurrences_batch_status_idx ON public.zsa_source_occurrences (import_batch_id, record_status);

CREATE TABLE public.zsa_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  group_sequence INTEGER NOT NULL,
  game_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  line1_occurrence_id UUID REFERENCES public.zsa_source_occurrences(id) ON DELETE SET NULL,
  line2_occurrence_id UUID REFERENCES public.zsa_source_occurrences(id) ON DELETE SET NULL,
  line3_occurrence_id UUID REFERENCES public.zsa_source_occurrences(id) ON DELETE SET NULL,
  completeness_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (completeness_status IN ('complete', 'incomplete', 'invalid', 'requires_review')),
  grouping_confirmed BOOLEAN NOT NULL DEFAULT false,
  draw_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_batch_id, game_name, group_sequence),
  CHECK (line1_occurrence_id IS NULL OR line1_occurrence_id <> line2_occurrence_id),
  CHECK (line1_occurrence_id IS NULL OR line1_occurrence_id <> line3_occurrence_id),
  CHECK (line2_occurrence_id IS NULL OR line2_occurrence_id <> line3_occurrence_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zsa_groups TO anon, authenticated;
GRANT ALL ON public.zsa_groups TO service_role;
ALTER TABLE public.zsa_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared testing access" ON public.zsa_groups FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX zsa_groups_game_sequence_idx ON public.zsa_groups (game_id, group_sequence);
CREATE INDEX zsa_groups_status_date_idx ON public.zsa_groups (completeness_status, draw_date);

CREATE TABLE public.zsa_winning_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.zsa_groups(id) ON DELETE RESTRICT,
  winning_numbers SMALLINT[] NOT NULL,
  winning_positions SMALLINT[],
  confirmation_status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (confirmation_status IN ('unconfirmed', 'confirmed', 'requires_review')),
  result_date DATE,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'official_source', 'imported')),
  source_text TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(winning_numbers) = 5),
  CHECK (winning_positions IS NULL OR cardinality(winning_positions) = 5),
  UNIQUE (group_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zsa_winning_results TO anon, authenticated;
GRANT ALL ON public.zsa_winning_results TO service_role;
ALTER TABLE public.zsa_winning_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared testing access" ON public.zsa_winning_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX zsa_winning_results_status_date_idx ON public.zsa_winning_results (confirmation_status, result_date);

CREATE TABLE public.zsa_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  threshold_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  dataset_snapshot JSONB NOT NULL,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  engine_version TEXT NOT NULL DEFAULT 'zsa-v1',
  dataset_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zsa_analysis_runs TO anon, authenticated;
GRANT ALL ON public.zsa_analysis_runs TO service_role;
ALTER TABLE public.zsa_analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared testing access" ON public.zsa_analysis_runs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX zsa_analysis_runs_created_idx ON public.zsa_analysis_runs (created_at DESC);
CREATE INDEX zsa_analysis_runs_dataset_idx ON public.zsa_analysis_runs (dataset_version, engine_version);

CREATE TABLE public.zsa_validation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_name TEXT NOT NULL,
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  game_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  line2_occurrence_id UUID REFERENCES public.zsa_source_occurrences(id) ON DELETE SET NULL,
  line3_occurrence_id UUID REFERENCES public.zsa_source_occurrences(id) ON DELETE SET NULL,
  line2_values SMALLINT[] NOT NULL,
  line3_values SMALLINT[],
  winning_numbers SMALLINT[] NOT NULL,
  winning_positions SMALLINT[],
  analysis_run_id UUID REFERENCES public.zsa_analysis_runs(id) ON DELETE SET NULL,
  analysis_snapshot JSONB NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'awaiting_line3' CHECK (validation_status IN ('awaiting_line3', 'awaiting_confirmation', 'ready', 'evaluated')),
  result_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(line2_values) = 10),
  CHECK (line3_values IS NULL OR cardinality(line3_values) = 10),
  CHECK (cardinality(winning_numbers) = 5),
  CHECK (winning_positions IS NULL OR cardinality(winning_positions) = 5)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zsa_validation_cases TO anon, authenticated;
GRANT ALL ON public.zsa_validation_cases TO service_role;
ALTER TABLE public.zsa_validation_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared testing access" ON public.zsa_validation_cases FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX zsa_validation_cases_created_idx ON public.zsa_validation_cases (created_at DESC);
