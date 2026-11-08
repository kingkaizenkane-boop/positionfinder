CREATE OR REPLACE FUNCTION public.prevent_confirmed_zsa_result_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.confirmation_status = 'confirmed' AND (
    NEW.winning_numbers IS DISTINCT FROM OLD.winning_numbers OR
    NEW.group_id IS DISTINCT FROM OLD.group_id OR
    (OLD.winning_positions IS NOT NULL AND NEW.winning_positions IS DISTINCT FROM OLD.winning_positions) OR
    (OLD.winning_positions IS NULL AND NEW.winning_positions IS NULL AND NEW.source_text IS DISTINCT FROM OLD.source_text)
  ) THEN
    RAISE EXCEPTION 'A confirmed winning result is immutable; submit a separate reviewed correction instead.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;