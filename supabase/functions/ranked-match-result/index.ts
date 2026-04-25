import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function computeRankTier(mmr: number): string {
  if (mmr >= 3000) return "apex";
  if (mmr >= 2500) return "diamond";
  if (mmr >= 2000) return "platinum";
  if (mmr >= 1500) return "gold";
  if (mmr >= 1000) return "silver";
  return "bronze";
}

function getKFactor(mmr: number, isPlaced: boolean, placementMatches: number): number {
  if (!isPlaced || placementMatches < 10) return 48;
  if (mmr < 1500) return 32;
  if (mmr < 2500) return 24;
  return 16;
}

function calcExpected(playerMmr: number, opponentMmr: number): number {
  return 1 / (1 + Math.pow(10, (opponentMmr - playerMmr) / 400));
}

function calcNewMmr(
  currentMmr: number,
  opponentMmr: number,
  score: number, // 1 = win, 0 = loss, 0.5 = draw
  kFactor: number,
  matchAvg: number,
  rollingAvg: number
): { newMmr: number; delta: number } {
  const expected = calcExpected(currentMmr, opponentMmr);
  let delta = Math.round(kFactor * (score - expected));

  // Performance bonus: +3 if match average beats rolling average by 15+
  if (score === 1 && matchAvg > 0 && rollingAvg > 0 && matchAvg - rollingAvg >= 15) {
    delta += 3;
  }

  // Floor at 0 MMR
  const newMmr = Math.max(0, currentMmr + delta);
  return { newMmr, delta: newMmr - currentMmr };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action; // 'submit_result' | 'start_match' | 'update_stats' | 'cancel_match'

    // ── START MATCH ────────────────────────────────────────
    if (action === "start_match") {
      const matchId = body.match_id;
      if (!matchId) {
        return new Response(JSON.stringify({ error: "match_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: match } = await admin
        .from("ranked_matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (!match || (match.player1_id !== user.id && match.player2_id !== user.id)) {
        return new Response(JSON.stringify({ error: "Match not found or not yours" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (match.status === "lobby") {
        await admin
          .from("ranked_matches")
          .update({
            status: "in_progress",
            started_at: new Date().toISOString(),
            lobby_code: body.lobby_code || null,
          })
          .eq("id", matchId);
      }

      return new Response(JSON.stringify({ status: "in_progress", match_id: matchId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE STATS (live during match) ───────────────────
    if (action === "update_stats") {
      const matchId = body.match_id;
      const stats = body.stats; // { average, checkout_pct, tons_180, tons_140_plus, high_finish, legs_won, legs_lost }

      if (!matchId || !stats) {
        return new Response(JSON.stringify({ error: "match_id and stats required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: match } = await admin
        .from("ranked_matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (!match || match.status !== "in_progress") {
        return new Response(JSON.stringify({ error: "Match not in progress" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isP1 = match.player1_id === user.id;
      const prefix = isP1 ? "player1" : "player2";

      await admin
        .from("ranked_matches")
        .update({
          [`${prefix}_average`]: stats.average || 0,
          [`${prefix}_checkout_pct`]: stats.checkout_pct || 0,
          [`${prefix}_180s`]: stats.tons_180 || 0,
          [`${prefix}_140_plus`]: stats.tons_140_plus || 0,
          [`${prefix}_high_finish`]: stats.high_finish || 0,
          [`${prefix}_legs_won`]: stats.legs_won || 0,
        })
        .eq("id", matchId);

      // Also update the other player's legs_lost
      const otherPrefix = isP1 ? "player2" : "player1";
      // legs_lost for the other player = this player's legs_won is already tracked separately
      // We don't update opponent's data from this player's submission

      return new Response(JSON.stringify({ status: "updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SUBMIT RESULT ──────────────────────────────────────
    if (action === "submit_result") {
      const matchId = body.match_id;
      const myLegsWon = body.my_legs_won;
      const opponentLegsWon = body.opponent_legs_won;
      const stats = body.stats || {};

      if (!matchId || myLegsWon === undefined || opponentLegsWon === undefined) {
        return new Response(JSON.stringify({ error: "match_id, my_legs_won, opponent_legs_won required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: match } = await admin
        .from("ranked_matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (!match) {
        return new Response(JSON.stringify({ error: "Match not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (match.player1_id !== user.id && match.player2_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your match" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isP1 = match.player1_id === user.id;
      const prefix = isP1 ? "player1" : "player2";

      // Store this player's claimed result
      const updateFields: Record<string, unknown> = {
        [`${prefix}_result_submitted`]: true,
      };

      if (isP1) {
        updateFields.player1_claimed_p1_legs = myLegsWon;
        updateFields.player1_claimed_p2_legs = opponentLegsWon;
        updateFields.player1_average = stats.average || match.player1_average;
        updateFields.player1_checkout_pct = stats.checkout_pct || match.player1_checkout_pct;
        updateFields.player1_180s = stats.tons_180 || match.player1_180s;
        updateFields.player1_140_plus = stats.tons_140_plus || match.player1_140_plus;
        updateFields.player1_high_finish = stats.high_finish || match.player1_high_finish;
        updateFields.player1_legs_won = myLegsWon;
        updateFields.player2_legs_won = opponentLegsWon;
      } else {
        updateFields.player2_claimed_p1_legs = opponentLegsWon;
        updateFields.player2_claimed_p2_legs = myLegsWon;
        updateFields.player2_average = stats.average || match.player2_average;
        updateFields.player2_checkout_pct = stats.checkout_pct || match.player2_checkout_pct;
        updateFields.player2_180s = stats.tons_180 || match.player2_180s;
        updateFields.player2_140_plus = stats.tons_140_plus || match.player2_140_plus;
        updateFields.player2_high_finish = stats.high_finish || match.player2_high_finish;
        // P2 submitting: their legs won
        if (!match.player1_result_submitted) {
          updateFields.player1_legs_won = opponentLegsWon;
          updateFields.player2_legs_won = myLegsWon;
        }
      }

      // Check if both have submitted
      const otherSubmitted = isP1 ? match.player2_result_submitted : match.player1_result_submitted;

      if (!otherSubmitted) {
        updateFields.status = "awaiting_confirmation";
        await admin.from("ranked_matches").update(updateFields).eq("id", matchId);

        return new Response(JSON.stringify({
          status: "awaiting_opponent",
          message: "Your result has been recorded. Waiting for opponent to confirm.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Both submitted — check agreement
      await admin.from("ranked_matches").update(updateFields).eq("id", matchId);

      // Re-fetch with both submissions
      const { data: finalMatch } = await admin
        .from("ranked_matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (!finalMatch) {
        return new Response(JSON.stringify({ error: "Match fetch failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if results agree
      const p1ClaimedP1 = finalMatch.player1_claimed_p1_legs;
      const p1ClaimedP2 = finalMatch.player1_claimed_p2_legs;
      const p2ClaimedP1 = finalMatch.player2_claimed_p1_legs;
      const p2ClaimedP2 = finalMatch.player2_claimed_p2_legs;

      const agree = p1ClaimedP1 === p2ClaimedP1 && p1ClaimedP2 === p2ClaimedP2;

      if (!agree) {
        await admin.from("ranked_matches").update({ status: "disputed" }).eq("id", matchId);

        return new Response(JSON.stringify({
          status: "disputed",
          message: "Results don't match. This match has been flagged for admin review.",
          your_claim: { p1_legs: isP1 ? myLegsWon : opponentLegsWon, p2_legs: isP1 ? opponentLegsWon : myLegsWon },
          opponent_claim: { p1_legs: isP1 ? p2ClaimedP1 : p1ClaimedP1, p2_legs: isP1 ? p2ClaimedP2 : p1ClaimedP2 },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── RESULTS AGREE — CALCULATE MMR ────────────────────
      const p1LegsWon = p1ClaimedP1!;
      const p2LegsWon = p1ClaimedP2!;

      let winnerId: string | null = null;
      let p1Score = 0.5; // draw
      let p2Score = 0.5;

      if (p1LegsWon > p2LegsWon) {
        winnerId = finalMatch.player1_id;
        p1Score = 1;
        p2Score = 0;
      } else if (p2LegsWon > p1LegsWon) {
        winnerId = finalMatch.player2_id;
        p1Score = 0;
        p2Score = 1;
      }

      // Get both ranked profiles
      const { data: p1Profile } = await admin
        .from("ranked_profiles")
        .select("*")
        .eq("id", finalMatch.player1_id)
        .single();

      const { data: p2Profile } = await admin
        .from("ranked_profiles")
        .select("*")
        .eq("id", finalMatch.player2_id)
        .single();

      if (!p1Profile || !p2Profile) {
        return new Response(JSON.stringify({ error: "Ranked profiles not found" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const p1K = getKFactor(p1Profile.mmr, p1Profile.is_placed, p1Profile.placement_matches);
      const p2K = getKFactor(p2Profile.mmr, p2Profile.is_placed, p2Profile.placement_matches);

      const p1Result = calcNewMmr(
        finalMatch.player1_mmr_before,
        finalMatch.player2_mmr_before,
        p1Score,
        p1K,
        Number(finalMatch.player1_average) || 0,
        Number(p1Profile.avg_match_average) || 0
      );

      const p2Result = calcNewMmr(
        finalMatch.player2_mmr_before,
        finalMatch.player1_mmr_before,
        p2Score,
        p2K,
        Number(finalMatch.player2_average) || 0,
        Number(p2Profile.avg_match_average) || 0
      );

      // Update the match record
      await admin.from("ranked_matches").update({
        winner_id: winnerId,
        player1_legs_won: p1LegsWon,
        player2_legs_won: p2LegsWon,
        player1_mmr_after: p1Result.newMmr,
        player2_mmr_after: p2Result.newMmr,
        player1_mmr_delta: p1Result.delta,
        player2_mmr_delta: p2Result.delta,
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", matchId);

      // ── UPDATE PLAYER 1 PROFILE ──────────────────────────
      const p1Wins = p1Profile.wins + (p1Score === 1 ? 1 : 0);
      const p1Losses = p1Profile.losses + (p1Score === 0 ? 1 : 0);
      const p1WinStreak = p1Score === 1 ? p1Profile.win_streak + 1 : 0;
      const p1Placements = p1Profile.placement_matches + 1;
      const p1TotalMatches = p1Wins + p1Losses;
      const p1NewAvg = p1TotalMatches > 0
        ? ((Number(p1Profile.avg_match_average) * (p1TotalMatches - 1)) + Number(finalMatch.player1_average || 0)) / p1TotalMatches
        : Number(finalMatch.player1_average || 0);
      const p1NewCheckout = p1TotalMatches > 0
        ? ((Number(p1Profile.avg_checkout_pct) * (p1TotalMatches - 1)) + Number(finalMatch.player1_checkout_pct || 0)) / p1TotalMatches
        : Number(finalMatch.player1_checkout_pct || 0);

      await admin.from("ranked_profiles").update({
        mmr: p1Result.newMmr,
        peak_mmr: Math.max(p1Profile.peak_mmr, p1Result.newMmr),
        rank_tier: computeRankTier(p1Result.newMmr),
        wins: p1Wins,
        losses: p1Losses,
        win_streak: p1WinStreak,
        best_win_streak: Math.max(p1Profile.best_win_streak, p1WinStreak),
        placement_matches: p1Placements,
        is_placed: p1Placements >= 10,
        total_180s: p1Profile.total_180s + (finalMatch.player1_180s || 0),
        total_140_plus: p1Profile.total_140_plus + (finalMatch.player1_140_plus || 0),
        total_tons: p1Profile.total_tons + ((finalMatch.player1_average || 0) >= 100 ? 1 : 0),
        total_high_finishes: p1Profile.total_high_finishes + ((finalMatch.player1_high_finish || 0) >= 80 ? 1 : 0),
        best_finish: Math.max(p1Profile.best_finish, finalMatch.player1_high_finish || 0),
        avg_match_average: Math.round(p1NewAvg * 100) / 100,
        avg_checkout_pct: Math.round(p1NewCheckout * 100) / 100,
        total_legs_won: p1Profile.total_legs_won + p1LegsWon,
        total_legs_lost: p1Profile.total_legs_lost + p2LegsWon,
        updated_at: new Date().toISOString(),
      }).eq("id", finalMatch.player1_id);

      // ── UPDATE PLAYER 2 PROFILE ──────────────────────────
      const p2Wins = p2Profile.wins + (p2Score === 1 ? 1 : 0);
      const p2Losses = p2Profile.losses + (p2Score === 0 ? 1 : 0);
      const p2WinStreak = p2Score === 1 ? p2Profile.win_streak + 1 : 0;
      const p2Placements = p2Profile.placement_matches + 1;
      const p2TotalMatches = p2Wins + p2Losses;
      const p2NewAvg = p2TotalMatches > 0
        ? ((Number(p2Profile.avg_match_average) * (p2TotalMatches - 1)) + Number(finalMatch.player2_average || 0)) / p2TotalMatches
        : Number(finalMatch.player2_average || 0);
      const p2NewCheckout = p2TotalMatches > 0
        ? ((Number(p2Profile.avg_checkout_pct) * (p2TotalMatches - 1)) + Number(finalMatch.player2_checkout_pct || 0)) / p2TotalMatches
        : Number(finalMatch.player2_checkout_pct || 0);

      await admin.from("ranked_profiles").update({
        mmr: p2Result.newMmr,
        peak_mmr: Math.max(p2Profile.peak_mmr, p2Result.newMmr),
        rank_tier: computeRankTier(p2Result.newMmr),
        wins: p2Wins,
        losses: p2Losses,
        win_streak: p2WinStreak,
        best_win_streak: Math.max(p2Profile.best_win_streak, p2WinStreak),
        placement_matches: p2Placements,
        is_placed: p2Placements >= 10,
        total_180s: p2Profile.total_180s + (finalMatch.player2_180s || 0),
        total_140_plus: p2Profile.total_140_plus + (finalMatch.player2_140_plus || 0),
        total_tons: p2Profile.total_tons + ((finalMatch.player2_average || 0) >= 100 ? 1 : 0),
        total_high_finishes: p2Profile.total_high_finishes + ((finalMatch.player2_high_finish || 0) >= 80 ? 1 : 0),
        best_finish: Math.max(p2Profile.best_finish, finalMatch.player2_high_finish || 0),
        avg_match_average: Math.round(p2NewAvg * 100) / 100,
        avg_checkout_pct: Math.round(p2NewCheckout * 100) / 100,
        total_legs_won: p2Profile.total_legs_won + p2LegsWon,
        total_legs_lost: p2Profile.total_legs_lost + p1LegsWon,
        updated_at: new Date().toISOString(),
      }).eq("id", finalMatch.player2_id);

      // Clean up queue entries
      await admin.from("ranked_queue").delete().eq("match_id", matchId);

      // Return the full result
      return new Response(JSON.stringify({
        status: "completed",
        match_id: matchId,
        winner_id: winnerId,
        player1: {
          id: finalMatch.player1_id,
          mmr_before: finalMatch.player1_mmr_before,
          mmr_after: p1Result.newMmr,
          mmr_delta: p1Result.delta,
          rank_tier: computeRankTier(p1Result.newMmr),
          legs_won: p1LegsWon,
          average: finalMatch.player1_average,
        },
        player2: {
          id: finalMatch.player2_id,
          mmr_before: finalMatch.player2_mmr_before,
          mmr_after: p2Result.newMmr,
          mmr_delta: p2Result.delta,
          rank_tier: computeRankTier(p2Result.newMmr),
          legs_won: p2LegsWon,
          average: finalMatch.player2_average,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CANCEL MATCH ───────────────────────────────────────
    if (action === "cancel_match") {
      const matchId = body.match_id;
      if (!matchId) {
        return new Response(JSON.stringify({ error: "match_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: match } = await admin
        .from("ranked_matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (!match || (match.player1_id !== user.id && match.player2_id !== user.id)) {
        return new Response(JSON.stringify({ error: "Match not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Can only cancel from lobby or pending
      if (!["pending", "lobby"].includes(match.status)) {
        return new Response(JSON.stringify({ error: "Cannot cancel a match that is already in progress" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("ranked_matches").update({ status: "cancelled" }).eq("id", matchId);
      await admin.from("ranked_queue").delete().eq("match_id", matchId);

      return new Response(JSON.stringify({ status: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: submit_result, start_match, update_stats, cancel_match" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
