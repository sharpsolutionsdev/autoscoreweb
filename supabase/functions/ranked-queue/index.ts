import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** MMR bracket widening schedule (seconds → range) */
const MMR_BRACKETS = [
  { after: 0, range: 150 },
  { after: 30, range: 300 },
  { after: 60, range: 500 },
  { after: 120, range: 9999 }, // match anyone
];

function computeRankTier(mmr: number): string {
  if (mmr >= 3000) return "apex";
  if (mmr >= 2500) return "diamond";
  if (mmr >= 2000) return "platinum";
  if (mmr >= 1500) return "gold";
  if (mmr >= 1000) return "silver";
  return "bronze";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client (respects RLS for auth)
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client (bypasses RLS for matchmaking writes)
    const admin = createClient(supabaseUrl, serviceKey);

    // Get authenticated user
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action; // 'join' | 'leave' | 'check'

    // ── JOIN QUEUE ──────────────────────────────────────────
    if (action === "join") {
      const matchFormat = body.match_format || "best_of_5";
      const mode = (body.mode || "501_bo5").toString();

      // ── Pro gate: ranked play requires an active subscription ──
      // (Free users get the 10-min demo on the scorer; ranked is Pro-only.)
      const { data: sub } = await admin
        .from("dartvoice_subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();
      const isPro = sub && (sub.status === "active" || sub.status === "trialing")
        && (!sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now());
      if (!isPro) {
        return new Response(JSON.stringify({
          error: "pro_required",
          message: "Ranked play requires DartVoice Pro. Free accounts get a 10-minute demo of the scorer; ranked matches need an active subscription.",
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Validate mode exists & is active ──
      const { data: modeRow } = await admin
        .from("ranked_modes")
        .select("code, is_active")
        .eq("code", mode)
        .maybeSingle();
      if (!modeRow || !modeRow.is_active) {
        return new Response(JSON.stringify({ error: "invalid_mode", mode }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure per-mode rating exists (upsert)
      let { data: rating } = await admin
        .from("ranked_ratings")
        .select("*")
        .eq("user_id", user.id)
        .eq("mode", mode)
        .maybeSingle();

      if (!rating) {
        const { data: season } = await admin
          .from("ranked_seasons")
          .select("id")
          .eq("is_active", true)
          .maybeSingle();

        const { data: newRating, error: ratErr } = await admin
          .from("ranked_ratings")
          .insert({
            user_id: user.id,
            mode,
            mmr: 1200,
            peak_mmr: 1200,
            rank_tier: "silver",
            season_id: season?.id || null,
          })
          .select()
          .single();
        if (ratErr) {
          return new Response(JSON.stringify({ error: "Failed to create rating", detail: ratErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        rating = newRating;
      }

      // Ensure ranked profile exists (legacy — for display name/avatar lookups)
      let { data: rankedProfile } = await admin
        .from("ranked_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!rankedProfile) {
        // Get display name from dartvoice_profiles
        const { data: dvProfile } = await admin
          .from("dartvoice_profiles")
          .select("display_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        // Get active season
        const { data: season } = await admin
          .from("ranked_seasons")
          .select("id")
          .eq("is_active", true)
          .maybeSingle();

        const { data: newProfile, error: insertErr } = await admin
          .from("ranked_profiles")
          .insert({
            id: user.id,
            mmr: 1200,
            peak_mmr: 1200,
            rank_tier: "silver",
            display_name: dvProfile?.display_name || user.email?.split("@")[0] || "Player",
            avatar_url: dvProfile?.avatar_url || null,
            season_id: season?.id || null,
          })
          .select()
          .single();

        if (insertErr) {
          return new Response(JSON.stringify({ error: "Failed to create ranked profile", detail: insertErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        rankedProfile = newProfile;
      }

      // Use per-mode rating for matchmaking (ranked_profiles is legacy 501-only display).
      const playerRating = rating;

      // Check not already in queue
      const { data: existing } = await admin
        .from("ranked_queue")
        .select("id, status, matched_with, match_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        if (existing.status === "matched") {
          return new Response(JSON.stringify({
            status: "matched",
            match_id: existing.match_id,
            matched_with: existing.matched_with,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Already waiting — return current status
        return new Response(JSON.stringify({ status: "waiting", queue_id: existing.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Clean expired entries first
      await admin
        .from("ranked_queue")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .eq("status", "waiting");

      // Insert into queue (per mode)
      const { data: queueEntry, error: queueErr } = await admin
        .from("ranked_queue")
        .insert({
          user_id: user.id,
          mmr: playerRating.mmr,
          rank_tier: playerRating.rank_tier,
          display_name: rankedProfile?.display_name || user.email?.split("@")[0] || "Player",
          match_format: matchFormat,
          mode,
        })
        .select()
        .single();

      if (queueErr) {
        return new Response(JSON.stringify({ error: "Failed to join queue", detail: queueErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ATTEMPT MATCHMAKING (per mode) ───────────────────
      const playerMmr = playerRating.mmr;
      const mmrRange = MMR_BRACKETS[0].range; // Start tight

      const { data: opponents } = await admin
        .from("ranked_queue")
        .select("*")
        .eq("status", "waiting")
        .eq("match_format", matchFormat)
        .eq("mode", mode)
        .neq("user_id", user.id)
        .gte("mmr", playerMmr - mmrRange)
        .lte("mmr", playerMmr + mmrRange)
        .order("joined_at", { ascending: true })
        .limit(1);

      if (opponents && opponents.length > 0) {
        const opponent = opponents[0];

        // Get active season
        const { data: season } = await admin
          .from("ranked_seasons")
          .select("id")
          .eq("is_active", true)
          .maybeSingle();

        // Get opponent's per-mode rating for MMR snapshot
        const { data: oppRating } = await admin
          .from("ranked_ratings")
          .select("mmr")
          .eq("user_id", opponent.user_id)
          .eq("mode", mode)
          .maybeSingle();

        // Create the match
        const { data: match, error: matchErr } = await admin
          .from("ranked_matches")
          .insert({
            season_id: season?.id || null,
            player1_id: opponent.user_id, // first queuer is P1
            player2_id: user.id,
            player1_mmr_before: oppRating?.mmr || opponent.mmr,
            player2_mmr_before: playerRating.mmr,
            match_format: matchFormat,
            mode,
            status: "lobby",
          })
          .select()
          .single();

        if (matchErr) {
          return new Response(JSON.stringify({ error: "Match creation failed", detail: matchErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update both queue entries to matched
        await admin
          .from("ranked_queue")
          .update({
            status: "matched",
            matched_with: user.id,
            match_id: match.id,
          })
          .eq("user_id", opponent.user_id);

        await admin
          .from("ranked_queue")
          .update({
            status: "matched",
            matched_with: opponent.user_id,
            match_id: match.id,
          })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({
          status: "matched",
          match_id: match.id,
          matched_with: opponent.user_id,
          opponent_display_name: opponent.display_name,
          opponent_mmr: opponent.mmr,
          opponent_rank_tier: opponent.rank_tier,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // No match yet — return waiting
      return new Response(JSON.stringify({
        status: "waiting",
        queue_id: queueEntry.id,
        mmr: playerRating.mmr,
        rank_tier: playerRating.rank_tier,
        mode,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LEAVE QUEUE ────────────────────────────────────────
    if (action === "leave") {
      await admin
        .from("ranked_queue")
        .delete()
        .eq("user_id", user.id)
        .eq("status", "waiting");

      return new Response(JSON.stringify({ status: "left" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CHECK STATUS ───────────────────────────────────────
    if (action === "check") {
      const { data: entry } = await admin
        .from("ranked_queue")
        .select("*, ranked_matches(*)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!entry) {
        return new Response(JSON.stringify({ status: "not_in_queue" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (entry.status === "matched") {
        // Get opponent profile
        const { data: oppProfile } = await admin
          .from("ranked_profiles")
          .select("id, display_name, mmr, rank_tier, wins, losses, avg_match_average, best_finish, avatar_url, is_placed, placement_matches")
          .eq("id", entry.matched_with)
          .single();

        return new Response(JSON.stringify({
          status: "matched",
          match_id: entry.match_id,
          matched_with: entry.matched_with,
          opponent: oppProfile,
          match: entry.ranked_matches,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Still waiting — check for wider bracket match
      const secondsInQueue = (Date.now() - new Date(entry.joined_at).getTime()) / 1000;
      let currentRange = MMR_BRACKETS[0].range;
      for (const bracket of MMR_BRACKETS) {
        if (secondsInQueue >= bracket.after) {
          currentRange = bracket.range;
        }
      }

      // Try wider bracket
      const { data: opponents } = await admin
        .from("ranked_queue")
        .select("*")
        .eq("status", "waiting")
        .eq("match_format", entry.match_format)
        .neq("user_id", user.id)
        .gte("mmr", entry.mmr - currentRange)
        .lte("mmr", entry.mmr + currentRange)
        .order("joined_at", { ascending: true })
        .limit(1);

      if (opponents && opponents.length > 0) {
        const opponent = opponents[0];

        const { data: season } = await admin
          .from("ranked_seasons")
          .select("id")
          .eq("is_active", true)
          .maybeSingle();

        const { data: oppRanked } = await admin
          .from("ranked_profiles")
          .select("mmr")
          .eq("id", opponent.user_id)
          .single();

        const { data: myRanked } = await admin
          .from("ranked_profiles")
          .select("mmr")
          .eq("id", user.id)
          .single();

        const { data: match } = await admin
          .from("ranked_matches")
          .insert({
            season_id: season?.id || null,
            player1_id: opponent.user_id,
            player2_id: user.id,
            player1_mmr_before: oppRanked?.mmr || opponent.mmr,
            player2_mmr_before: myRanked?.mmr || entry.mmr,
            match_format: entry.match_format,
            status: "lobby",
          })
          .select()
          .single();

        if (match) {
          await admin
            .from("ranked_queue")
            .update({ status: "matched", matched_with: user.id, match_id: match.id })
            .eq("user_id", opponent.user_id);

          await admin
            .from("ranked_queue")
            .update({ status: "matched", matched_with: opponent.user_id, match_id: match.id })
            .eq("user_id", user.id);

          const { data: oppProfile } = await admin
            .from("ranked_profiles")
            .select("id, display_name, mmr, rank_tier, wins, losses, avg_match_average, best_finish, avatar_url")
            .eq("id", opponent.user_id)
            .single();

          return new Response(JSON.stringify({
            status: "matched",
            match_id: match.id,
            matched_with: opponent.user_id,
            opponent: oppProfile,
            match: match,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({
        status: "waiting",
        queue_id: entry.id,
        seconds_in_queue: Math.round(secondsInQueue),
        current_mmr_range: currentRange,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: join, leave, check" }), {
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
