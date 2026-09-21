ALTER TABLE public.games ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.historical_draws ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.analysis_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.transitions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.import_batches ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historical_draws TO authenticated;
GRANT ALL ON public.historical_draws TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_sessions TO authenticated;
GRANT ALL ON public.analysis_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transitions TO authenticated;
GRANT ALL ON public.transitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
REVOKE ALL ON public.games FROM anon;
REVOKE ALL ON public.historical_draws FROM anon;
REVOKE ALL ON public.analysis_sessions FROM anon;
REVOKE ALL ON public.transitions FROM anon;
REVOKE ALL ON public.import_batches FROM anon;

DROP POLICY IF EXISTS "Public can manage games" ON public.games;
DROP POLICY IF EXISTS "Public can manage historical draws" ON public.historical_draws;
DROP POLICY IF EXISTS "Public can manage analysis sessions" ON public.analysis_sessions;
DROP POLICY IF EXISTS "Public can manage transitions" ON public.transitions;
DROP POLICY IF EXISTS "Public can manage import batches" ON public.import_batches;

CREATE POLICY "Signed-in users can view legacy and own games" ON public.games FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Signed-in users can create own games" ON public.games FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can update own games" ON public.games FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can delete own games" ON public.games FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Signed-in users can view legacy and own historical draws" ON public.historical_draws FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Signed-in users can create own historical draws" ON public.historical_draws FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can update own historical draws" ON public.historical_draws FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can delete own historical draws" ON public.historical_draws FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Signed-in users can view legacy and own analysis sessions" ON public.analysis_sessions FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Signed-in users can create own analysis sessions" ON public.analysis_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can update own analysis sessions" ON public.analysis_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can delete own analysis sessions" ON public.analysis_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Signed-in users can view legacy and own transitions" ON public.transitions FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Signed-in users can create own transitions" ON public.transitions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can update own transitions" ON public.transitions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can delete own transitions" ON public.transitions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Signed-in users can view legacy and own import batches" ON public.import_batches FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Signed-in users can create own import batches" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can update own import batches" ON public.import_batches FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Signed-in users can delete own import batches" ON public.import_batches FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX games_user_id_idx ON public.games (user_id);
CREATE INDEX historical_draws_user_id_idx ON public.historical_draws (user_id);
CREATE INDEX analysis_sessions_user_id_idx ON public.analysis_sessions (user_id);
CREATE INDEX transitions_user_id_idx ON public.transitions (user_id);
CREATE INDEX import_batches_user_id_idx ON public.import_batches (user_id);