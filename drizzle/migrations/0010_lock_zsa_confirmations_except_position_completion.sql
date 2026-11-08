CREATE OR REPLACE FUNCTION public.prevent_confirmed_zsa_result_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.confirmation_status = 'confirmed' THEN
      RAISE EXCEPTION 'A confirmed winning result is immutable; submit a separate reviewed correction instead.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.confirmation_status = 'confirmed' THEN
    IF OLD.winning_positions IS NULL THEN
      IF NEW.winning_positions IS NULL
        OR NEW.confirmation_status IS DISTINCT FROM OLD.confirmation_status
        OR NEW.winning_numbers IS DISTINCT FROM OLD.winning_numbers
        OR NEW.group_id IS DISTINCT FROM OLD.group_id
        OR NEW.result_date IS DISTINCT FROM OLD.result_date
        OR NEW.source_type IS DISTINCT FROM OLD.source_type
        OR NEW.source_text IS DISTINCT FROM OLD.source_text
        OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'A confirmed winning result is immutable; only verified positions may be added when none were previously recorded.';
      END IF;
    ELSIF NEW.confirmation_status IS DISTINCT FROM OLD.confirmation_status
      OR NEW.winning_numbers IS DISTINCT FROM OLD.winning_numbers
      OR NEW.winning_positions IS DISTINCT FROM OLD.winning_positions
      OR NEW.group_id IS DISTINCT FROM OLD.group_id
      OR NEW.result_date IS DISTINCT FROM OLD.result_date
      OR NEW.source_type IS DISTINCT FROM OLD.source_type
      OR NEW.source_text IS DISTINCT FROM OLD.source_text
      OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'A confirmed winning result is immutable; submit a separate reviewed correction instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;