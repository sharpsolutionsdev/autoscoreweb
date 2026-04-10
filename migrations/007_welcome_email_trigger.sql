-- ============================================================================
-- DartVoice Welcome Email Trigger — Migration 007
-- ============================================================================
-- Sends a 'welcome' email via Supabase Edge Functions when a new 
-- profile is created (which happens automatically on signup).
--
-- REQUIRES: pg_net extension to be enabled in Supabase.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dartvoice_handle_new_signup_email()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- 1. Resolve the email from auth.users (since public.dartvoice_profiles only has ID)
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;

  -- 2. Trigger the Edge Function
  -- Note: We use the SERVICE_ROLE_KEY to bypass function auth.
  -- In a real Supabase environment, you would set this via:
  -- ALTER DATABASE postgres SET "app.settings.service_role_key" = 'your-key-here';
  IF user_email IS NOT NULL THEN
    PERFORM
      net.http_post(
        url := 'https://poyjykgqsvgimssbhsuz.supabase.co/functions/v1/send-dartvoice-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), 'REPLACE_WITH_SERVICE_ROLE_KEY')
        ),
        body := jsonb_build_object(
          'type', 'welcome',
          'to', user_email
        )
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on dartvoice_profiles
-- This table is populated AFTER auth.users insert via migration 002.
DROP TRIGGER IF EXISTS on_dartvoice_profile_created ON public.dartvoice_profiles;
CREATE TRIGGER on_dartvoice_profile_created
  AFTER INSERT ON public.dartvoice_profiles
  FOR EACH ROW EXECUTE FUNCTION public.dartvoice_handle_new_signup_email();

-- ============================================================================
-- IMPORTANT:
-- To make this work, run this in your Supabase SQL Editor:
-- CREATE EXTENSION IF NOT EXISTS pg_net;
-- ALTER DATABASE postgres SET "app.settings.service_role_key" = 'YOUR_SERVICE_ROLE_KEY';
-- ============================================================================
