/**
 * SUPABASE EDGE FUNCTION: Process Payment
 * 
 * Deploy this to Supabase:
 * 1. In your Supabase dashboard, go to Edge Functions
 * 2. Create new function called "process-payment"
 * 3. Copy this entire code
 * 4. Add these env vars:
 *    - PAYPAL_CLIENT_ID
 *    - PAYPAL_CLIENT_SECRET
 *    - PAYPAL_API_URL (https://api.paypal.com for production)
 *
 * This function:
 * - Verifies PayPal payment server-side
 * - Validates pricing against database
 * - Checks promo codes
 * - Atomically inserts tickets (prevents double-charging)
 * - Returns transaction proof
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const paypalClientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const paypalApiUrl = Deno.env.get("PAYPAL_API_URL") || "https://api.paypal.com";

  if (!supabaseUrl || !supabaseAnonKey || !paypalClientId || !paypalClientSecret) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const requestBody = await req.json();
    const { paypalOrderId, raffleId, quantity, promoCode, userId } = requestBody;

    // Validate inputs
    if (!paypalOrderId || !raffleId || !quantity || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (quantity < 1 || quantity > 50) {
      return new Response(
        JSON.stringify({ error: "Invalid quantity. Must be 1-50" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // ===== STEP 1: Verify PayPal Payment Server-Side =====
    const paypalAuth = btoa(`${paypalClientId}:${paypalClientSecret}`);
    const paypalVerifyUrl = `${paypalApiUrl}/v2/checkout/orders/${paypalOrderId}`;

    const paypalResponse = await fetch(paypalVerifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${paypalAuth}`,
        "Content-Type": "application/json",
      },
    });

    if (!paypalResponse.ok) {
      console.error("PayPal verification failed:", paypalResponse.status);
      return new Response(
        JSON.stringify({ error: "PayPal verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paypalOrder = await paypalResponse.json();

    // Ensure payment is COMPLETED
    if (paypalOrder.status !== "COMPLETED") {
      return new Response(
        JSON.stringify({ error: `Payment not completed. Status: ${paypalOrder.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 2: Fetch Raffle & Calculate Price Server-Side =====
    const { data: raffle, error: raffleError } = await supabaseClient
      .from("raffles")
      .select("*")
      .eq("id", raffleId)
      .single();

    if (raffleError || !raffle) {
      return new Response(
        JSON.stringify({ error: "Raffle not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 3: Validate PayPal Amount =====
    let subtotal = quantity * raffle.price_per_ticket;
    let discount = 0;

    // Only apply promo if provided and valid
    if (promoCode) {
      const { data: promo, error: promoError } = await supabaseClient
        .from("promo_codes")
        .select("*")
        .eq("code", promoCode.toUpperCase())
        .eq("active", true)
        .single();

      if (!promoError && promo && promo.usage_remaining > 0) {
        // Validate promo is still valid
        if (new Date(promo.expires_at) > new Date()) {
          let eligibleAmount = subtotal > promo.max_discount_base ? promo.max_discount_base : subtotal;
          discount = eligibleAmount * (promo.discount_percent / 100);
        }
      }
    }

    const expectedTotal = (subtotal - discount).toFixed(2);
    const paypalAmount = paypalOrder.purchase_units[0].amount.value;

    // Allow small floating point differences
    if (Math.abs(parseFloat(paypalAmount) - parseFloat(expectedTotal)) > 0.01) {
      console.error(`Price mismatch: Expected £${expectedTotal}, got £${paypalAmount}`);
      return new Response(
        JSON.stringify({
          error: "Price mismatch. Possible fraud attempt.",
          details: { expected: expectedTotal, received: paypalAmount },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 4: Check for Duplicate Transactions =====
    const paypalTxnId = paypalOrder.id;
    const { data: existingTicket } = await supabaseClient
      .from("user_tickets")
      .select("id")
      .eq("paypal_transaction_id", paypalTxnId)
      .single();

    if (existingTicket) {
      return new Response(
        JSON.stringify({
          error: "Transaction already processed",
          transactionId: paypalTxnId,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 5: Atomically Insert Tickets =====
    const { data: insertedTicket, error: insertError } = await supabaseClient
      .from("user_tickets")
      .insert([
        {
          user_id: userId,
          raffle_id: raffleId,
          qty: quantity,
          paypal_transaction_id: paypalTxnId,
          purchase_price: expectedTotal,
          promo_code_used: promoCode ? promoCode.toUpperCase() : null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("DB insert error:", insertError);
      return new Response(
        JSON.stringify({
          error: "Failed to save tickets to database",
          details: insertError.message,
          transactionId: paypalTxnId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 6: Decrement Promo Usage (if applicable) =====
    if (promoCode) {
      await supabaseClient.rpc("decrement_promo_usage", {
        promo_code: promoCode.toUpperCase(),
      });
    }

    // ===== SUCCESS =====
    return new Response(
      JSON.stringify({
        success: true,
        message: `${quantity} ticket${quantity > 1 ? "s" : ""} added to your vault!`,
        ticketId: insertedTicket.id,
        transactionId: paypalTxnId,
        raffleTitle: raffle.title,
        quantity: quantity,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
