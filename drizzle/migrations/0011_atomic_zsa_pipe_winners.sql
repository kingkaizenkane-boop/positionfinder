CREATE OR REPLACE FUNCTION public.save_zsa_confirmed_import(p_batch_id uuid, p_provider text, p_source_name text, p_source_reference text, p_raw_text text, p_occurrences jsonb, p_groups jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_group jsonb; v_row public.zsa_groups; v_source public.zsa_source_occurrences; v_values smallint[];
BEGIN
IF EXISTS (SELECT 1 FROM public.import_batches WHERE id = p_batch_id) THEN RETURN p_batch_id; END IF;
v_id := public.save_zsa_source_import(p_batch_id,p_provider,p_source_name,p_source_reference,p_raw_text,p_occurrences,p_groups);
FOR v_group IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
IF COALESCE((v_group->>'ingestWinners')::boolean,false) AND v_group->>'completeness' = 'complete' THEN
SELECT g.* INTO STRICT v_row FROM public.zsa_groups g JOIN public.zsa_source_occurrences o ON o.id=g.line3_occurrence_id WHERE g.import_batch_id=v_id AND o.source_line_start=(v_group->>'line3SourceLine')::integer;
SELECT * INTO STRICT v_source FROM public.zsa_source_occurrences WHERE id=v_row.line3_occurrence_id;
v_values := v_source.position_values[1:5];
IF cardinality(v_source.position_values) <> 10 OR position('|' in v_source.source_text)=0 OR (SELECT count(DISTINCT n) FROM unnest(v_values) n)<>5 OR EXISTS (SELECT 1 FROM unnest(v_source.position_values) n WHERE n<1 OR n>90) THEN RAISE EXCEPTION 'Invalid pipe-format winners'; END IF;
INSERT INTO public.zsa_winning_results(group_id,winning_numbers,winning_positions,confirmation_status,result_date,source_type,source_text,confirmed_at) VALUES(v_row.id,v_values,ARRAY[1,2,3,4,5]::smallint[],'confirmed',v_source.draw_date,'imported',v_source.source_text,now());
END IF;
END LOOP;
RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.save_zsa_confirmed_import(uuid,text,text,text,text,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_zsa_confirmed_import(uuid,text,text,text,text,jsonb,jsonb) TO anon, authenticated, service_role;