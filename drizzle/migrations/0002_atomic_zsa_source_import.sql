CREATE OR REPLACE FUNCTION public.save_zsa_source_import(
  p_batch_id UUID,
  p_provider TEXT,
  p_source_name TEXT,
  p_raw_text TEXT,
  p_occurrences JSONB,
  p_groups JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch UUID;
  v_occurrence JSONB;
  v_group JSONB;
  v_game_id UUID;
  v_occurrence_id UUID;
  v_game_ids JSONB := '{}'::jsonb;
  v_occurrence_ids JSONB := '{}'::jsonb;
  v_game_name TEXT;
  v_game_key TEXT;
  v_line1 INTEGER;
  v_line2 INTEGER;
  v_line3 INTEGER;
  v_draw_count INTEGER;
  v_rejected_count INTEGER;
BEGIN
  SELECT id INTO v_batch FROM public.import_batches WHERE id = p_batch_id;
  IF v_batch IS NOT NULL THEN
    RETURN v_batch;
  END IF;

  v_draw_count := jsonb_array_length(COALESCE(p_occurrences, '[]'::jsonb));
  SELECT count(*) INTO v_rejected_count
  FROM jsonb_array_elements(COALESCE(p_occurrences, '[]'::jsonb)) AS item
  WHERE jsonb_array_length(COALESCE(item->'issues', '[]'::jsonb)) > 0;

  INSERT INTO public.import_batches (id, provider, source_name, raw_text, games_detected, draws_detected, draws_rejected, status)
  VALUES (p_batch_id, p_provider, p_source_name, p_raw_text, jsonb_array_length(COALESCE(p_groups, '[]'::jsonb)), v_draw_count, v_rejected_count, 'completed');

  FOR v_group IN SELECT value FROM jsonb_array_elements(COALESCE(p_groups, '[]'::jsonb)) LOOP
    v_game_name := v_group->>'gameName';
    v_game_key := lower(regexp_replace(btrim(v_game_name), '\s+', ' ', 'g'));
    IF NOT (v_game_ids ? v_game_key) THEN
      SELECT id INTO v_game_id FROM public.games
      WHERE lower(regexp_replace(btrim(provider), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(p_provider), '\s+', ' ', 'g'))
        AND lower(regexp_replace(btrim(game_name), '\s+', ' ', 'g')) = v_game_key
      LIMIT 1;
      IF v_game_id IS NULL THEN
        BEGIN
          INSERT INTO public.games (game_name, provider)
          VALUES (v_game_name, p_provider)
          RETURNING id INTO v_game_id;
        EXCEPTION WHEN unique_violation THEN
          SELECT id INTO v_game_id FROM public.games
          WHERE lower(regexp_replace(btrim(provider), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(p_provider), '\s+', ' ', 'g'))
            AND lower(regexp_replace(btrim(game_name), '\s+', ' ', 'g')) = v_game_key
          LIMIT 1;
        END;
      END IF;
      v_game_ids := v_game_ids || jsonb_build_object(v_game_key, v_game_id::text);
    END IF;
  END LOOP;

  FOR v_occurrence IN SELECT value FROM jsonb_array_elements(COALESCE(p_occurrences, '[]'::jsonb)) LOOP
    v_game_key := lower(regexp_replace(btrim(v_occurrence->>'gameName'), '\s+', ' ', 'g'));
    v_game_id := NULLIF(v_game_ids->>v_game_key, '')::uuid;
    INSERT INTO public.zsa_source_occurrences (
      import_batch_id, game_id, provider, game_name, source_order, source_line_start, source_line_end,
      source_text, draw_number, draw_date, line_role, position_values, record_status, issues
    ) VALUES (
      p_batch_id, v_game_id, p_provider, v_occurrence->>'gameName', (v_occurrence->>'sourceOrder')::integer,
      (v_occurrence->>'sourceLine')::integer, (v_occurrence->>'sourceLine')::integer, v_occurrence->>'rawText',
      NULLIF(v_occurrence->>'drawNumber', '')::integer, NULLIF(v_occurrence->>'drawDate', '')::date,
      NULLIF(v_occurrence->>'lineRole', '')::smallint,
      CASE WHEN jsonb_typeof(v_occurrence->'numbers') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(v_occurrence->'numbers')::smallint) ELSE NULL END,
      v_occurrence->>'recordStatus', COALESCE(v_occurrence->'issues', '[]'::jsonb)
    ) RETURNING id INTO v_occurrence_id;
    v_occurrence_ids := v_occurrence_ids || jsonb_build_object((v_occurrence->>'sourceLine')::text, v_occurrence_id::text);
  END LOOP;

  FOR v_group IN SELECT value FROM jsonb_array_elements(COALESCE(p_groups, '[]'::jsonb)) LOOP
    v_game_name := v_group->>'gameName';
    v_game_key := lower(regexp_replace(btrim(v_game_name), '\s+', ' ', 'g'));
    v_game_id := NULLIF(v_game_ids->>v_game_key, '')::uuid;
    v_line1 := NULLIF(v_group->>'line1SourceLine', '')::integer;
    v_line2 := NULLIF(v_group->>'line2SourceLine', '')::integer;
    v_line3 := NULLIF(v_group->>'line3SourceLine', '')::integer;
    INSERT INTO public.zsa_groups (
      game_id, import_batch_id, group_sequence, game_name, provider, line1_occurrence_id, line2_occurrence_id,
      line3_occurrence_id, completeness_status, grouping_confirmed, draw_date
    ) VALUES (
      v_game_id, p_batch_id, (v_group->>'sequence')::integer, v_game_name, p_provider,
      NULLIF(v_occurrence_ids->>v_line1::text, '')::uuid,
      NULLIF(v_occurrence_ids->>v_line2::text, '')::uuid,
      NULLIF(v_occurrence_ids->>v_line3::text, '')::uuid,
      v_group->>'completeness', true, NULLIF(v_group->>'drawDate', '')::date
    );
  END LOOP;

  RETURN p_batch_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_zsa_source_import(UUID, TEXT, TEXT, TEXT, JSONB, JSONB) TO anon, authenticated, service_role;