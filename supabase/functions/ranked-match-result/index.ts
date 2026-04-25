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

function calcNewMmr(
  currentMmr: number,
  opponentMmr: number,
  score: number,
  kFactor: number,
  matchAvg: number,
  rollingAvg: number
): { newMmr: number; delta: number } {
  const expected = 1 / (1 + Math.pow(10, (opponentMmr - currentMmr) / 400));
  let delta = Math.round(kFactor * (score - expected));

  // Performance bonus: +3 if match average beats rolling average by 15+
  if (score === 1 && matchAvg > 0 && rollingAvg > 30 && matchAvg - rollingAvg >= 15) {
    delta += 3;
  }

  const newMmr = Math.max(100, currentMmr + delta);
  return { newMmr, delta: Math.round(delta) };
}

async function updateProfileAfterMatch(admin: any, profile: any, score: number, result: any, matchAvg: any, matchCheckout: any, legsWon: number, legsLost: number, s180s: number, s140s: number, s100s: number, sHigh: number) {
  const wins = profile.wins + (score === 1 ? 1 : 0);
  const losses = profile.losses + (score === 0 ? 1 : 0);
  const winStreak = score === 1 ? profile.win_streak + 1 : 0;
  const placements = profile.placement_matches + 1;
  const totalMatches = wins + losses;
  
  const newAvg = totalMatches > 1 ? ((Number(profile.avg_match_average) * (totalMatches - 1)) + Number(matchAvg || 0)) / totalMatches : Number(matchAvg || 0);
  const newCheckout = totalMatches > 1 ? ((Number(profile.avg_checkout_pct) * (totalMatches - 1)) + Number(matchCheckout || 0)) / totalMatches : Number(matchCheckout || 0);

  await admin.from("ranked_profiles").update({
    mmr: result.newMmr,
    peak_mmr: Math.max(profile.peak_mmr, result.newMmr),
    rank_tier: computeRankTier(result.newMmr),
    wins,
    losses,
    win_streak: winStreak,
    best_win_streak: Math.max(profile.best_win_streak, winStreak),
    placement_matches: placements,
    is_placed: placements >= 10,
    total_180s: profile.total_180s + (s180s || 0),
    total_140_plus: profile.total_140_plus + (s140s || 0),
    total_tons: profile.total_tons + (s100s || 0),
    total_high_finishes: profile.total_high_finishes + ((sHigh || 0) >= 80 ? 1 : 0),
    best_finish: Math.max(profile.best_finish, sHigh || 0),
    avg_match_average: Math.round(newAvg * 100) / 100,
    avg_checkout_pct: Math.round(newCheckout * 100) / 100,
    total_legs_won: profile.total_legs_won + legsWon,
    total_legs_lost: profile.total_legs_lost + legsLost,
    updated_at: new Date().toISOString(),
  }).eq("id", profile.id);
}

async function processMatchCompletion(finalMatch: any, admin: any) {
  const p1LegsWon = finalMatch.player1_legs_won;
  const p2LegsWon = finalMatch.player2_legs_won;

  let winnerId: string | null = null;
  let p1Score = 0.5;
  let p2Score = 0.5;

  if (p1LegsWon > p2LegsWon) {
    winnerId = finalMatch.player1_id;
    p1Score = 1; p2Score = 0;
  } else if (p2LegsWon > p1LegsWon) {
    winnerId = finalMatch.player2_id;
    p1Score = 0; p2Score = 1;
  }

  const { data: p1Profile } = await admin.from("ranked_profiles").select("*").eq("id", finalMatch.player1_id).single();
  const { data: p2Profile } = await admin.from("ranked_profiles").select("*").eq("id", finalMatch.player2_id).single();

  if (!p1Profile || !p2Profile) throw new Error("Profiles not found");

  const p1K = getKFactor(p1Profile.mmr, p1Profile.is_placed, p1Profile.placement_matches);
  const p2K = getKFactor(p2Profile.mmr, p2Profile.is_placed, p2Profile.placement_matches);

  const p1Result = calcNewMmr(finalMatch.player1_mmr_before, finalMatch.player2_mmr_before, p1Score, p1K, Number(finalMatch.player1_average) || 0, Number(p1Profile.avg_match_average) || 0);
  const p2Result = calcNewMmr(finalMatch.player2_mmr_before, finalMatch.player1_mmr_before, p2Score, p2K, Number(finalMatch.player2_average) || 0, Number(p2Profile.avg_match_average) || 0);

  await admin.from("ranked_matches").update({
    winner_id: winnerId,
    player1_mmr_after: p1Result.newMmr,
    player2_mmr_after: p2Result.newMmr,
    player1_mmr_delta: p1Result.delta,
    player2_mmr_delta: p2Result.delta,
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", finalMatch.id);

  await updateProfileAfterMatch(admin, p1Profile, p1Score, p1Result, finalMatch.player1_average, finalMatch.player1_checkout_pct, p1LegsWon, p2LegsWon, finalMatch.player1_180s, finalMatch.player1_140_plus, finalMatch.player1_100_plus, finalMatch.player1_high_finish);
  await updateProfileAfterMatch(admin, p2Profile, p2Score, p2Result, finalMatch.player2_average, finalMatch.player2_checkout_pct, p2LegsWon, p1LegsWon, finalMatch.player2_180s, finalMatch.player2_140_plus, finalMatch.player2_100_plus, finalMatch.player2_high_finish);

  await admin.from("ranked_queue").delete().eq("match_id", finalMatch.id);

  return new Response(JSON.stringify({ 
    status: "completed", 
    match_id: finalMatch.id, 
    winner_id: winnerId,
    player1: { id: finalMatch.player1_id, mmr_after: p1Result.newMmr, mmr_delta: p1Result.delta },
    player2: { id: finalMatch.player2_id, mmr_after: p2Result.newMmr, mmr_delta: p2Result.delta }
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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
      const { data: match } = await admin.from("ranked_matches").select("*").eq("id", matchId).single();
      if (!match) return new Response(JSON.stringify({ error: "Match not found" }), { status: 404, headers: corsHeaders });
      
      const isP1 = match.player1_id === user.id;
      const prefix = isP1 ? "player1" : "player2";
      const updateFields: any = { [`${prefix}_result_submitted`]: true };

      if (isP1) {
        updateFields.player1_claimed_p1_legs = myLegsWon;
        updateFields.player1_claimed_p2_legs = opponentLegsWon;
        updateFields.player1_average = stats.average || 0;
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
        return await processMatchCompletion(finalMatch, admin);
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
      return await processMatchCompletion(finalMatch, admin);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
