// ranked-match-sweeper
//
// Auto-resolves stuck ranked matches. Run on a 10-minute cron (see migrations
// /022_ranked_match_sweeper.sql) and idempotent — safe to call repeatedly.
//
// Rules:
//   1. One player submitted, opponent didn't, and >24h since the submission
//      → auto-accept submitter's claim (silent player forfeits).
//   2. Match `in_progress` >48h since started_at with NO submissions
//      → cancel.
//   3. Match `lobby` or `pending` >2h since created_at, never started
//      → cancel.
//
// Auth: only callable with the service role key (cron) OR by an authenticated
// admin user. Will refuse otherwise.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processMatchCompletion } from "../_shared/match-completion.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FORFEIT_AFTER_MS = 24 * 60 * 60 * 1000; // 24h
const ABANDON_AFTER_MS = 48 * 60 * 60 * 1000; // 48h
const LOBBY_AFTER_MS = 2 * 60 * 60 * 1000; // 2h

function ageMs(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}

interface SweepReport {
  scanned: number;
  forfeited: string[];
  cancelledAbandoned: string[];
  cancelledStaleLobby: string[];
  errors: { matchId: string; err: string }[];
}

async function sweep(admin: any): Promise<SweepReport> {
  const report: SweepReport = {
    scanned: 0,
    forfeited: [],
    cancelledAbandoned: [],
    cancelledStaleLobby: [],
    errors: [],
  };

  // Pull every active match in one shot — small enough table that this is
  // cheap, and the sweeper rate is so low that we don't need pagination.
  const { data: matches, error } = await admin
    .from("ranked_matches")
    .select("*")
    .in("status", ["in_progress", "lobby", "pending"]);

  if (error) {
    report.errors.push({ matchId: "(query)", err: error.message });
    return report;
  }

  report.scanned = matches?.length ?? 0;

  for (const m of matches ?? []) {
    try {
      // Stale lobby/pending matches: never started, idle too long.
      if (m.status === "lobby" || m.status === "pending") {
        if (ageMs(m.created_at) >= LOBBY_AFTER_MS && !m.started_at) {
          await admin.from("ranked_matches").update({
            status: "cancelled",
            completed_at: new Date().toISOString(),
          }).eq("id", m.id);
          await admin.from("ranked_queue").delete().eq("match_id", m.id);
          report.cancelledStaleLobby.push(m.id);
        }
        continue;
      }

      // status === "in_progress" from here on.
      const p1Sub = !!m.player1_result_submitted;
      const p2Sub = !!m.player2_result_submitted;

      // Both submitted is impossible to land here (the result fn would have
      // moved it to `completed` or `disputed`), but just in case — skip.
      if (p1Sub && p2Sub) continue;

      if (p1Sub || p2Sub) {
        const submittedAt = p1Sub ? m.player1_result_submitted_at : m.player2_result_submitted_at;
        if (ageMs(submittedAt) >= FORFEIT_AFTER_MS) {
          // Auto-accept submitter's claimed legs as the truth.
          const claimedP1Legs = p1Sub ? m.player1_claimed_p1_legs : m.player2_claimed_p1_legs;
          const claimedP2Legs = p1Sub ? m.player1_claimed_p2_legs : m.player2_claimed_p2_legs;

          if (claimedP1Legs == null || claimedP2Legs == null) {
            // Bad data — fall through to abandonment cancel below.
          } else {
            const nowIso = new Date().toISOString();
            const otherPrefix = p1Sub ? "player2" : "player1";
            await admin.from("ranked_matches").update({
              [`${otherPrefix}_result_submitted`]: true,
              [`${otherPrefix}_result_submitted_at`]: nowIso,
              player1_legs_won: claimedP1Legs,
              player2_legs_won: claimedP2Legs,
              [`${otherPrefix}_claimed_p1_legs`]: claimedP1Legs,
              [`${otherPrefix}_claimed_p2_legs`]: claimedP2Legs,
            }).eq("id", m.id);

            const { data: finalMatch } = await admin
              .from("ranked_matches")
              .select("*")
              .eq("id", m.id)
              .single();
            await processMatchCompletion(finalMatch, admin);
            report.forfeited.push(m.id);
            continue;
          }
        }
      }

      // No submissions and the match is way too old — abandon it.
      if (!p1Sub && !p2Sub && ageMs(m.started_at) >= ABANDON_AFTER_MS) {
        await admin.from("ranked_matches").update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        }).eq("id", m.id);
        await admin.from("ranked_queue").delete().eq("match_id", m.id);
        report.cancelledAbandoned.push(m.id);
      }
    } catch (e) {
      report.errors.push({ matchId: m.id, err: String((e as Error)?.message || e) });
    }
  }

  return report;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isServiceCall = bearer && bearer === serviceKey;

    const admin = createClient(supabaseUrl, serviceKey);

    if (!isServiceCall) {
      // User-initiated call must be an admin.
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: corsHeaders });
      }
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const { data: isAdmin } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
      }
    }

    const report = await sweep(admin);

    // Lightweight log row so we can see what cron has been doing in the DB.
    try {
      await admin.from("ranked_match_sweeper_log").insert({
        scanned: report.scanned,
        forfeited_count: report.forfeited.length,
        cancelled_abandoned_count: report.cancelledAbandoned.length,
        cancelled_stale_lobby_count: report.cancelledStaleLobby.length,
        errors_count: report.errors.length,
        details: report,
      });
    } catch (_) {
      // Log table is optional — don't fail the sweep if it's missing.
    }

    return new Response(JSON.stringify({ ok: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
