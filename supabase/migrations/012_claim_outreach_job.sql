CREATE OR REPLACE FUNCTION public.claim_outreach_job(p_worker uuid)
RETURNS TABLE (id uuid, platform text, payload jsonb, run_after timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH c AS (
    SELECT id FROM public.outreach_queue
    WHERE status='pending' AND (run_after IS NULL OR run_after <= now())
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.outreach_queue q
  SET status='processing', claimed_by = p_worker, claimed_at = now()
  FROM c WHERE q.id = c.id
  RETURNING q.id, q.platform, q.payload, q.run_after;
END;
$$;
