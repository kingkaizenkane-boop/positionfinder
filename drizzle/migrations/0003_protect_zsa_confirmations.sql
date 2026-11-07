CREATE OR REPLACE FUNCTION public.prevent_confirmed_zsa_result_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.confirmation_status = 'confirmed' AND (
    NEW.winning_numbers IS DISTINCT FROM OLD.winning_numbers OR
    NEW.winning_positions IS DISTINCT FROM OLD.winning_positions OR
    NEW.group_id IS DISTINCT FROM OLD.group_id
  ) THEN
    RAISE EXCEPTION 'A confirmed winning result cannot be overwritten; preserve it as a separate reviewed version.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zsa_winning_results_prevent_confirmed_overwrite
BEFORE UPDATE ON public.zsa_winning_results
FOR EACH ROW EXECUTE FUNCTION public.prevent_confirmed_zsa_result_overwrite();
