// Shared MMR + match-completion helpers used by ranked-match-result and
// ranked-match-sweeper. Keep this file dependency-free (Deno + supabase-js v2
// only) so both edge functions can import it directly.

export const DEFAULT_MODE = "501_bo5";

export function computeRankTier(mmr: number): string {
  if (mmr >= 3000) return "apex";
  if (mmr >= 2500) return "diamond";
  if (mmr >= 2000) return "platinum";
  if (mmr >= 1500) return "gold";
  if (mmr >= 1000) return "silver";
  return "bronze";
}

export function getKFactor(mmr: number, isPlaced: boolean, placementMatches: number): number {
  if (!isPlaced || placementMatches < 10) return 48;
  if (mmr < 1500) return 32;
  if (mmr < 2500) return 24;
  return 16;
}

export function calcNewMmr(
  currentMmr: number,
  opponentMmr: number,
  score: number,
  kFactor: number,
  matchAvg: number,
  rollingAvg: number,
): { newMmr: number; delta: number } {
  const expected = 1 / (1 + Math.pow(10, (opponentMmr - currentMmr) / 400));
  let delta = Math.round(kFactor * (score - expected));

  // Performance bonus: +3 if match average beats rolling average by 15+.
  if (score === 1 && matchAvg > 0 && rollingAvg > 30 && matchAvg - rollingAvg >= 15) {
    delta += 3;
  }

  const newMmr = Math.max(100, currentMmr + delta);
  return { newMmr, delta: Math.round(delta) };
}

/** Load the per-mode rating, creating it (with defaults) if missing. */
export async function getOrCreateRating(admin: any, userId: string, mode: string) {
  const { data: existing } = await admin
    .from("ranked_ratings")
    .select("*")
    .eq("user_id", userId)
    .eq("mode", mode)
    .maybeSingle();
  if (existing) return existing;

  const { data: season } = await admin
    .from("ranked_seasons")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const { data: created } = await admin
    .from("ranked_ratings")
    .insert({
      user_id: userId,
      mode,
      mmr: 1200,
      peak_mmr: 1200,
      rank_tier: "silver",
      season_id: season?.id || null,
    })
    .select()
    .single();
  return created;
}


export async function updateProfileAfterMatch(
  admin: any,
  profile: any,
  score: number,
  result: { newMmr: number; delta: number },
  matchAvg: any,
  matchCheckout: any,
  matchFirst9: any,
  legsWon: number,
  legsLost: number,
  s180s: number,
  s140s: number,
  s100s: number,
  sHigh: number,
  mode: string,
) {
  const wins = profile.wins + (score === 1 ? 1 : 0);
  const losses = profile.losses + (score === 0 ? 1 : 0);
  const winStreak = score === 1 ? profile.win_streak + 1 : 0;
  const placements = profile.placement_matches + 1;
  const totalMatches = wins + losses;

  const newAvg = totalMatches > 1
    ? ((Number(profile.avg_match_average) * (totalMatches - 1)) + Number(matchAvg || 0)) / totalMatches
    : Number(matchAvg || 0);
  const newCheckout = totalMatches > 1
    ? ((Number(profile.avg_checkout_pct) * (totalMatches - 1)) + Number(matchCheckout || 0)) / totalMatches
    : Number(matchCheckout || 0);
  const prevFirst9 = Number(profile.avg_first_9 || 0);
  const newFirst9 = totalMatches > 1
    ? ((prevFirst9 * (totalMatches - 1)) + Number(matchFirst9 || 0)) / totalMatches
    : Number(matchFirst9 || 0);

  const ratingPatch = {
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
    avg_first_9: Math.round(newFirst9 * 100) / 100,
    avg_checkout_pct: Math.round(newCheckout * 100) / 100,
    total_legs_won: profile.total_legs_won + legsWon,
    total_legs_lost: profile.total_legs_lost + legsLost,
    matches_played: totalMatches,
    last_match_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Per-mode rating row (new source of truth)
  await admin
    .from("ranked_ratings")
    .update(ratingPatch)
    .eq("user_id", profile.user_id)
    .eq("mode", mode);

  // Mirror to legacy ranked_profiles for the default mode so existing UI keeps
  // working until rankings.html / ranked.html consume ranked_ratings directly.
  if (mode === DEFAULT_MODE) {
    const legacyPatch = { ...ratingPatch } as any;
    delete legacyPatch.matches_played;
    delete legacyPatch.last_match_at;
    delete legacyPatch.avg_first_9;
    await admin.from("ranked_profiles").update(legacyPatch).eq("id", profile.user_id);
  }
}

/**
 * Finalises a match: computes MMR deltas, marks the match completed, updates
 * both profiles, and clears any matchmaking queue rows. Returns a small
 * summary for callers that want to reply to the user.
 */
export async function processMatchCompletion(finalMatch: any, admin: any) {
  const p1LegsWon = finalMatch.player1_legs_won;
  const p2LegsWon = finalMatch.player2_legs_won;
  const mode = finalMatch.mode || DEFAULT_MODE;

  let winnerId: string | null = null;
  let p1Score = 0.5;
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

  // Per-mode ratings are the source of truth.
  const p1Profile = await getOrCreateRating(admin, finalMatch.player1_id, mode);
  const p2Profile = await getOrCreateRating(admin, finalMatch.player2_id, mode);

  if (!p1Profile || !p2Profile) throw new Error("Ratings not found");

  const p1K = getKFactor(p1Profile.mmr, p1Profile.is_placed, p1Profile.placement_matches);
  const p2K = getKFactor(p2Profile.mmr, p2Profile.is_placed, p2Profile.placement_matches);

  const p1Result = calcNewMmr(
    finalMatch.player1_mmr_before,
    finalMatch.player2_mmr_before,
    p1Score,
    p1K,
    Number(finalMatch.player1_average) || 0,
    Number(p1Profile.avg_match_average) || 0,
  );
  const p2Result = calcNewMmr(
    finalMatch.player2_mmr_before,
    finalMatch.player1_mmr_before,
    p2Score,
    p2K,
    Number(finalMatch.player2_average) || 0,
    Number(p2Profile.avg_match_average) || 0,
  );

  await admin.from("ranked_matches").update({
    winner_id: winnerId,
    player1_mmr_after: p1Result.newMmr,
    player2_mmr_after: p2Result.newMmr,
    player1_mmr_delta: p1Result.delta,
    player2_mmr_delta: p2Result.delta,
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", finalMatch.id);

  await updateProfileAfterMatch(
    admin,
    p1Profile,
    p1Score,
    p1Result,
    finalMatch.player1_average,
    finalMatch.player1_checkout_pct,
    finalMatch.player1_first_9,
    p1LegsWon,
    p2LegsWon,
    finalMatch.player1_180s,
    finalMatch.player1_140_plus,
    finalMatch.player1_100_plus,
    finalMatch.player1_high_finish,
    mode,
  );
  await updateProfileAfterMatch(
    admin,
    p2Profile,
    p2Score,
    p2Result,
    finalMatch.player2_average,
    finalMatch.player2_checkout_pct,
    finalMatch.player2_first_9,
    p2LegsWon,
    p1LegsWon,
    finalMatch.player2_180s,
    finalMatch.player2_140_plus,
    finalMatch.player2_100_plus,
    finalMatch.player2_high_finish,
    mode,
  );

  await admin.from("ranked_queue").delete().eq("match_id", finalMatch.id);

  return {
    matchId: finalMatch.id,
    mode,
    winnerId,
    p1: { id: finalMatch.player1_id, mmr_after: p1Result.newMmr, mmr_delta: p1Result.delta },
    p2: { id: finalMatch.player2_id, mmr_after: p2Result.newMmr, mmr_delta: p2Result.delta },
  };
}
