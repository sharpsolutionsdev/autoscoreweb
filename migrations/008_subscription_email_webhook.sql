-- ============================================================================
-- DartVoice Subscription Email Webhook — Migration 008
-- ============================================================================
-- Triggers the 'send-confirmation' Edge Function whenever a subscription 
-- row is created or updated. This handles:
--   - Welcome (on trialing)
--   - Confirmation (on active)
--   - Payment Failed (on past_due)
--   - Cancellation (on canceled)
--
-- REQUIRES: pg_net extension to be enabled in Supabase.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dartvoice_handle_subscription_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if this is a new row OR the status has changed
  IF (TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status)) THEN
    PERFORM
      net.http_post(
        url := 'https://poyjykgqsvgimssbhsuz.supabase.co/functions/v1/send-confirmation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA'
        ),
        body := jsonb_build_object(
          'record', row_to_json(NEW),
          'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
        )
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_dartvoice_subscription_change ON public.dartvoice_subscriptions;
CREATE TRIGGER on_dartvoice_subscription_change
  AFTER INSERT OR UPDATE ON public.dartvoice_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.dartvoice_handle_subscription_email();

-- ============================================================================
-- REMINDER: Ensure SERVICE_ROLE_KEY is set in your DB settings.
-- ============================================================================
