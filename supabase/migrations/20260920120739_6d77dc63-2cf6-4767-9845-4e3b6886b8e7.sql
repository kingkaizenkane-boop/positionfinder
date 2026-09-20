CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO anon;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can manage games" ON public.games FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE public.historical_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  draw_number INTEGER NOT NULL,
  draw_date DATE NOT NULL,
  p1 SMALLINT NOT NULL CHECK (p1 BETWEEN 1 AND 90),
  p2 SMALLINT NOT NULL CHECK (p2 BETWEEN 1 AND 90),
  p3 SMALLINT NOT NULL CHECK (p3 BETWEEN 1 AND 90),
  p4 SMALLINT NOT NULL CHECK (p4 BETWEEN 1 AND 90),
  p5 SMALLINT NOT NULL CHECK (p5 BETWEEN 1 AND 90),
  p6 SMALLINT NOT NULL CHECK (p6 BETWEEN 1 AND 90),
  p7 SMALLINT NOT NULL CHECK (p7 BETWEEN 1 AND 90),
  p8 SMALLINT NOT NULL CHECK (p8 BETWEEN 1 AND 90),
  p9 SMALLINT NOT NULL CHECK (p9 BETWEEN 1 AND 90),
  p10 SMALLINT NOT NULL CHECK (p10 BETWEEN 1 AND 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, draw_number, draw_date, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historical_draws TO anon;
GRANT ALL ON public.historical_draws TO service_role;
ALTER TABLE public.historical_draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can manage historical draws" ON public.historical_draws FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX historical_draws_game_date_idx ON public.historical_draws (game_id, draw_date, draw_number);
CREATE INDEX historical_draws_game_positions_idx ON public.historical_draws (game_id, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10);

CREATE TABLE public.analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  game_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  played_date DATE NOT NULL,
  current_p1 SMALLINT NOT NULL CHECK (current_p1 BETWEEN 1 AND 90),
  current_p2 SMALLINT NOT NULL CHECK (current_p2 BETWEEN 1 AND 90),
  current_p3 SMALLINT NOT NULL CHECK (current_p3 BETWEEN 1 AND 90),
  current_p4 SMALLINT NOT NULL CHECK (current_p4 BETWEEN 1 AND 90),
  current_p5 SMALLINT NOT NULL CHECK (current_p5 BETWEEN 1 AND 90),
  current_p6 SMALLINT NOT NULL CHECK (current_p6 BETWEEN 1 AND 90),
  current_p7 SMALLINT NOT NULL CHECK (current_p7 BETWEEN 1 AND 90),
  current_p8 SMALLINT NOT NULL CHECK (current_p8 BETWEEN 1 AND 90),
  current_p9 SMALLINT NOT NULL CHECK (current_p9 BETWEEN 1 AND 90),
  current_p10 SMALLINT NOT NULL CHECK (current_p10 BETWEEN 1 AND 90),
  minimum_occurrences INTEGER NOT NULL DEFAULT 2 CHECK (minimum_occurrences IN (1, 2, 3, 4, 5, 10)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_sessions TO anon;
GRANT ALL ON public.analysis_sessions TO service_role;
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can manage analysis sessions" ON public.analysis_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX analysis_sessions_created_at_idx ON public.analysis_sessions (created_at DESC);

CREATE TABLE public.transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_session_id UUID NOT NULL REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
  historical_draw_id UUID NOT NULL REFERENCES public.historical_draws(id) ON DELETE CASCADE,
  next_draw_id UUID NOT NULL REFERENCES public.historical_draws(id) ON DELETE CASCADE,
  source_position SMALLINT NOT NULL CHECK (source_position BETWEEN 1 AND 10),
  source_number SMALLINT NOT NULL CHECK (source_number BETWEEN 1 AND 90),
  target_position SMALLINT NOT NULL CHECK (target_position BETWEEN 1 AND 10),
  target_number SMALLINT NOT NULL CHECK (target_number BETWEEN 1 AND 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_session_id, historical_draw_id, next_draw_id, source_position, target_position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transitions TO anon;
GRANT ALL ON public.transitions TO service_role;
ALTER TABLE public.transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can manage transitions" ON public.transitions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX transitions_session_group_idx ON public.transitions (analysis_session_id, source_position, source_number, target_position, target_number);
CREATE INDEX transitions_target_idx ON public.transitions (target_position, target_number);