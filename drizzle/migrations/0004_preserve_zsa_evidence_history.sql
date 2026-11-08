CREATE TABLE public.zsa_winning_result_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmed_result_id UUID NOT NULL REFERENCES public.zsa_winning_results(id) ON DELETE RESTRICT,
  group_id UUID NOT NULL REFERENCES public.zsa_groups(id) ON DELETE RESTRICT,
  proposed_winning_numbers SMALLINT[] NOT NULL,
  proposed_winning_positions SMALLINT[],
  review_status TEXT NOT NULL DEFAULT 'requires_review' CHECK (review_status IN ('requires_review', 'accepted', 'rejected')),
  source_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(proposed_winning_numbers) = 5),
  CHECK (proposed_winning_positions IS NULL OR cardinality(proposed_winning_positions) = 5)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zsa_winning_result_revisions TO anon, authenticated;
GRANT ALL ON public.zsa_winning_result_revisions TO service_role;
ALTER TABLE public.zsa_winning_result_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared testing access" ON public.zsa_winning_result_revisions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX zsa_winning_result_revisions_group_created_idx ON public.zsa_winning_result_revisions (group_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_zsa_evidence_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Saved ZSA evidence is immutable; create a separate reviewed record instead.';
END;
$$;

CREATE TRIGGER zsa_analysis_runs_immutable
BEFORE UPDATE OR DELETE ON public.zsa_analysis_runs
FOR EACH ROW EXECUTE FUNCTION public.prevent_zsa_evidence_mutation();

CREATE TRIGGER zsa_winning_result_revisions_immutable
BEFORE UPDATE OR DELETE ON public.zsa_winning_result_revisions
FOR EACH ROW EXECUTE FUNCTION public.prevent_zsa_evidence_mutation();

CREATE OR REPLACE FUNCTION public.prevent_evaluated_zsa_case_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.validation_status = 'evaluated' THEN
    RAISE EXCEPTION 'An evaluated ZSA case is frozen; create a new validation case for another evaluation.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zsa_validation_cases_freeze_evaluated
BEFORE UPDATE OR DELETE ON public.zsa_validation_cases
FOR EACH ROW EXECUTE FUNCTION public.prevent_evaluated_zsa_case_mutation();