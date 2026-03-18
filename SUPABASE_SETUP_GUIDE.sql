/**
 * SUPABASE SETUP GUIDE - OcheRaffles Secure Payment System
 * 
 * This guide covers all the backend setup required for the new secure payment flow.
 * 
 * ====================================================================
 * STEP 1: CREATE PROMO_CODES TABLE
 * ====================================================================
 * 
 * Run this SQL in your Supabase SQL Editor:
 */

CREATE TABLE IF NOT EXISTS promo_codes (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 50,
    max_discount_base NUMERIC(11, 2) NOT NULL DEFAULT 25,
    usage_limit INT DEFAULT NULL,
    usage_remaining INT DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id)
);

-- Add indexes for faster queries
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active ON promo_codes(active);

-- Enable RLS (Row Level Security)
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Allow public to read active promo codes
CREATE POLICY "Allow public to read active promos" ON promo_codes
    FOR SELECT USING (active = TRUE);

/**
 * ====================================================================
 * STEP 2: CREATE DECREMENT_PROMO_USAGE FUNCTION
 * ====================================================================
 * 
 * Run this SQL in your Supabase SQL Editor:
 */

CREATE OR REPLACE FUNCTION decrement_promo_usage(promo_code TEXT)
RETURNS void
LANGUAGE SQL
AS $$
  UPDATE promo_codes
  SET usage_remaining = GREATEST(0, usage_remaining - 1)
  WHERE code = UPPER(promo_code)
    AND active = TRUE
    AND expires_at > NOW()
    AND usage_remaining > 0;
$$;

/**
 * ====================================================================
 * STEP 3: DEPLOY EDGE FUNCTION
 * ====================================================================
 * 
 * In your Supabase Dashboard:
 * 
 * 1. Go to "Edge Functions" in the left sidebar
 * 2. Click "Create Function"
 * 3. Name it: process-payment
 * 4. Delete the default code and paste the content from:
 *    supabase_edge_function_process_payment.js
 * 
 * 5. Add Environment Variables (in the function settings):
 *    - PAYPAL_CLIENT_ID: Your PayPal Business Client ID
 *    - PAYPAL_CLIENT_SECRET: Your PayPal Business Client Secret
 *    - PAYPAL_API_URL: https://api.paypal.com (production)
 * 
 * 6. Click "Deploy"
 */

/**
 * ====================================================================
 * STEP 4: UPDATE YOUR PAYPAL CONFIGURATION
 * ====================================================================
 * 
 * In your raffle.html, update these lines:
 * 
 * LINE 16 (PayPal SDK):
 * OLD: <script src="https://www.paypal.com/sdk/js?client-id=test&currency=GBP&intent=capture"></script>
 * NEW: <script src="https://www.paypal.com/sdk/js?client-id=YOUR_PAYPAL_CLIENT_ID_HERE&currency=GBP&intent=capture"></script>
 * 
 * LINE 197 (Edge Function URL):
 * OLD: const supabaseUrl = 'https://YOUR_SUPABASE_URL';
 * NEW: const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co';
 */

/**
 * ====================================================================
 * STEP 5: CREATE TEST PROMO CODE
 * ====================================================================
 * 
 * Run this SQL to create the "RYAN180" promo code:
 */

INSERT INTO promo_codes (code, discount_percent, max_discount_base, usage_limit, usage_remaining, active, expires_at)
VALUES (
    'RYAN180',
    50,
    25,
    1000,
    1000,
    TRUE,
    NOW() + INTERVAL '1 year'
);

/**
 * ====================================================================
 * STEP 6: UPDATE USER_TICKETS TABLE (Add Promo Column)
 * ====================================================================
 * 
 * If your user_tickets table doesn't have these columns, add them:
 */

ALTER TABLE user_tickets
ADD COLUMN IF NOT EXISTS promo_code_used VARCHAR(50);

/**
 * ====================================================================
 * IMPORTANT CONFIGURATION NOTES
 * ====================================================================
 * 
 * 1. PayPal Setup:
 *    - Log in to https://developer.paypal.com/
 *    - Go to your Business Account
 *    - Under "Apps & Credentials", copy:
 *      * Client ID
 *      * Client Secret
 *    - These go into your Supabase Edge Function environment variables
 * 
 * 2. Security:
 *    - ALL payment validation happens server-side in the Edge Function
 *    - Promo codes cannot be applied client-side
 *    - Prices are verified against database
 *    - Duplicate transactions are prevented
 * 
 * 3. Error Handling:
 *    - If PayPal verification fails, no tickets are created
 *    - If DB insert fails after PayPal capture, user must contact support
 *    - All errors are logged for debugging
 * 
 * 4. Promo Code Management:
 *    - Add new promo codes directly in Supabase via the SQL Editor
 *    - Set expires_at dates appropriately
 *    - Track usage_remaining to prevent abuse
 * 
 * ====================================================================
 * TESTING THE FLOW
 * ====================================================================
 * 
 * 1. Create a test user
 * 2. Navigate to a raffle page
 * 3. Try to purchase with PayPal test mode
 * 4. Check Supabase "user_tickets" table to verify entry was created
 * 5. Try to apply promo code "RYAN180"
 * 6. Verify discount is applied
 * 
 * Monitor the Edge Functions logs for any errors.
 */

/**
 * ====================================================================
 * USEFUL QUERIES FOR MANAGEMENT
 * ====================================================================
 */

-- View all promo codes
SELECT code, discount_percent, usage_remaining, active, expires_at FROM promo_codes;

-- Check if a specific promo is still valid
SELECT * FROM promo_codes 
WHERE code = 'RYAN180' 
  AND active = TRUE 
  AND expires_at > NOW()
  AND usage_remaining > 0;

-- View all tickets from a user (replace 'YOUR_USER_ID' with actual user ID)
-- SELECT * FROM user_tickets 
-- WHERE user_id = 'YOUR_USER_ID'
-- ORDER BY created_at DESC;

-- Check for duplicate transactions
SELECT paypal_transaction_id, COUNT(*) as count 
FROM user_tickets 
GROUP BY paypal_transaction_id 
HAVING COUNT(*) > 1;

-- View transaction history with user info
SELECT 
    ut.id,
    u.email,
    p.username,
    r.title as raffle_title,
    ut.qty,
    ut.purchase_price,
    ut.promo_code_used,
    ut.created_at
FROM user_tickets ut
LEFT JOIN auth.users u ON ut.user_id = u.id
LEFT JOIN profiles p ON ut.user_id = p.id
LEFT JOIN raffles r ON ut.raffle_id = r.id
ORDER BY ut.created_at DESC
LIMIT 50;
