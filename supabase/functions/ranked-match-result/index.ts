import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processMatchCompletion } from "../_shared/match-completion.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const action = body.action;

    if (action === "start_match") {
      const matchId = body.match_id;
      const { data: match } = await admin.from("ranked_matches").select("*").eq("id", matchId).single();
      if (!match || (match.player1_id !== user.id && match.player2_id !== user.id)) return new Response(JSON.stringify({ error: "Match not found" }), { status: 404, headers: corsHeaders });
      if (match.status === "lobby") {
        await admin.from("ranked_matches").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", matchId);
      }
      return new Response(JSON.stringify({ status: "in_progress" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "submit_result") {
      const matchId = body.match_id;
      const myLegsWon = body.my_legs_won;
      const opponentLegsWon = body.opponent_legs_won;
      const stats = body.stats || {};
      // Anti-cheat: only stats sourced from the live DartCounter scrape (or our
      // native scorer for native modes) count for ranked. Anything else gets
      // flagged for review.
      const claimedSource = (body.stats_source || "manual").toString();
      const stats_source = (claimedSource === "dartcounter" || claimedSource === "native") ? claimedSource : "manual";
      const stats_verified = stats_source !== "manual";
      const dartcounter_match_id = body.dartcounter_match_id || null;

      const { data: match } = await admin.from("ranked_matches").select("*").eq("id", matchId).single();
      if (!match) return new Response(JSON.stringify({ error: "Match not found" }), { status: 404, headers: corsHeaders });

      const isP1 = match.player1_id === user.id;
      const prefix = isP1 ? "player1" : "player2";
      const nowIso = new Date().toISOString();
      // Match is verified only if EVERY submission was from a trusted source.
      // First submitter sets the source; second submitter degrades it if manual.
      const firstSubmission = !match.player1_result_submitted && !match.player2_result_submitted;
      const newStatsSource = firstSubmission
        ? stats_source
        : (match.stats_source === "manual" || stats_source === "manual" ? "manual" : match.stats_source);
      const newStatsVerified = newStatsSource !== "manual";

      const updateFields: any = {
        [`${prefix}_result_submitted`]: true,
        [`${prefix}_result_submitted_at`]: nowIso,
        stats_source: newStatsSource,
        stats_verified: newStatsVerified,
      };
      if (dartcounter_match_id && !match.dartcounter_match_id) {
        updateFields.dartcounter_match_id = dartcounter_match_id;
      }

      if (isP1) {
        updateFields.player1_claimed_p1_legs = myLegsWon;
        updateFields.player1_claimed_p2_legs = opponentLegsWon;
        updateFields.player1_average = stats.average || 0;
        updateFields.player1_first_9 = stats.first_9_avg || stats.first_9 || 0;
        updateFields.player1_checkout_pct = stats.checkout_pct || 0;
        updateFields.player1_180s = stats.tons_180 || 0;
        updateFields.player1_140_plus = stats.tons_140_plus || 0;
        updateFields.player1_100_plus = stats.tons_100_plus || 0;
        updateFields.player1_high_finish = stats.high_finish || 0;
        updateFields.player1_legs_won = myLegsWon;
        updateFields.player2_legs_won = opponentLegsWon;
      } else {
        updateFields.player2_claimed_p1_legs = opponentLegsWon;
        updateFields.player2_claimed_p2_legs = myLegsWon;
        updateFields.player2_average = stats.average || 0;
        updateFields.player2_first_9 = stats.first_9_avg || stats.first_9 || 0;
        updateFields.player2_checkout_pct = stats.checkout_pct || 0;
        updateFields.player2_180s = stats.tons_180 || 0;
        updateFields.player2_140_plus = stats.tons_140_plus || 0;
        updateFields.player2_100_plus = stats.tons_100_plus || 0;
        updateFields.player2_high_finish = stats.high_finish || 0;
        if (!match.player1_result_submitted) {
          updateFields.player1_legs_won = opponentLegsWon;
          updateFields.player2_legs_won = myLegsWon;
        }
      }

      await admin.from("ranked_matches").update(updateFields).eq("id", matchId);
      const { data: finalMatch } = await admin.from("ranked_matches").select("*").eq("id", matchId).single();

      if (finalMatch.player1_result_submitted && finalMatch.player2_result_submitted) {
        const agree = finalMatch.player1_claimed_p1_legs === finalMatch.player2_claimed_p1_legs && finalMatch.player1_claimed_p2_legs === finalMatch.player2_claimed_p2_legs;
        if (!agree) {
          await admin.from("ranked_matches").update({ status: "disputed" }).eq("id", matchId);
          return new Response(JSON.stringify({ status: "disputed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const summary = await processMatchCompletion(finalMatch, admin);
        return new Response(JSON.stringify({
          status: "completed",
          match_id: summary.matchId,
          winner_id: summary.winnerId,
          player1: summary.p1,
          player2: summary.p2,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ status: "awaiting_opponent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "admin_resolve") {
      const { data: isAdmin } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!isAdmin) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });

      const { match_id, p1_legs, p2_legs, cancel } = body;
      if (cancel) {
        await admin.from("ranked_matches").update({ status: "cancelled" }).eq("id", match_id);
        await admin.from("ranked_queue").delete().eq("match_id", match_id);
        return new Response(JSON.stringify({ status: "cancelled" }), { headers: corsHeaders });
      }

      await admin.from("ranked_matches").update({ player1_legs_won: p1_legs, player2_legs_won: p2_legs }).eq("id", match_id);
      const { data: finalMatch } = await admin.from("ranked_matches").select("*").eq("id", match_id).single();
      const summary = await processMatchCompletion(finalMatch, admin);
      return new Response(JSON.stringify({
        status: "completed",
        match_id: summary.matchId,
        winner_id: summary.winnerId,
        player1: summary.p1,
        player2: summary.p2,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
