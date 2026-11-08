ALTER TABLE public.zsa_groups ADD COLUMN source_reference TEXT;

CREATE OR REPLACE FUNCTION public.prevent_confirmed_zsa_result_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.confirmation_status = 'confirmed' THEN
    RAISE EXCEPTION 'A confirmed winning result is immutable; submit a separate reviewed correction instead.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zsa_winning_results_prevent_confirmed_delete
BEFORE DELETE ON public.zsa_winning_results
FOR EACH ROW EXECUTE FUNCTION public.prevent_confirmed_zsa_result_overwrite();