GRANT SELECT, INSERT, UPDATE, DELETE ON public.games, public.historical_draws, public.analysis_sessions, public.transitions, public.import_batches TO anon, authenticated;
GRANT ALL ON public.games, public.historical_draws, public.analysis_sessions, public.transitions, public.import_batches TO service_role;
CREATE POLICY "Shared testing access" ON public.games FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Shared testing access" ON public.historical_draws FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Shared testing access" ON public.analysis_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Shared testing access" ON public.transitions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Shared testing access" ON public.import_batches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);