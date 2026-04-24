-- ============================================================================
-- Migration 010: Phone Verification Status
-- ============================================================================
-- Adds fields to track phone verification state and security codes.

ALTER TABLE public.dartvoice_profiles 
    ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS phone_verification_code TEXT;

-- Update RLS if necessary (usually public.dartvoice_profiles is already RLS-enabled)
-- Existing policies should cover these new columns if they allow user-level updates.
-- ============================================================================
