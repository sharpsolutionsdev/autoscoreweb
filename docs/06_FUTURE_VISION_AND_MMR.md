# Future Vision: Ranked Darts & The MMR System

*Internal Staff Document — Confidential. Last reviewed: April 2026.*

> **Status:** Plan and partial implementation. The detailed engineering breakdown lives in [`ranked_mode_implementation_plan.md`](../ranked_mode_implementation_plan.md). Public landing pages already exist at [`ranked.html`](../ranked.html) and [`rankings.html`](../rankings.html). Database tables, edge functions, and UI work are tracked in the per-phase status below.

As DartVoice secures its foundation as a premium utility, the next strategic chapter shifts to **competitive home darts** through a proprietary **MMR (Matchmaking Rating) System**.

---

## 1. Ditching the Traditional "Prize Money Tournaments"

Online darts has long relied on ad-hoc prize-money tournaments which suffer from rampant cheating, complex administration, and low global engagement. DartVoice's plan is to replace that archaic model with an always-on, hyper-competitive **Ranked Darts ladder** — built natively into the same scorer the player already uses every day.

## 2. The MMR (Matchmaking Rating) System

Rather than playing for £5 pots on weekends, players log in daily to grind their MMR — exactly like competitive video games (*Valorant*, *League of Legends*, *Rocket League*).

- **The Elo grind:** every match played through DartVoice's ranked queue affects a hidden Elo rating.
- **Rank tiers:** Bronze, Silver, Gold, Platinum, Diamond, Apex — each with subdivisions.
- **Matchmaking:** the system pairs players of similar Elo over a video-call connection, ensuring tight, thrilling matches.
- **Anti-smurf:** new accounts are placed via a calibration sequence (10 placement matches) before being released into the open ladder.

## 3. Global Leaderboards & Leagues

- **Open global ranking:** transparent worldwide leaderboard, top 500 spots especially prestigious.
- **Seasonal leagues:** structured Seasons ("Season 1: Summer Climb"). Soft reset between seasons.
- **High-Stakes Queue (optional):** a gated tier where players stake in-app currency or entry fees for moderated, anti-cheat-enforced championship brackets. Not a launch feature.

## 4. The Anti-Cheat Ecosystem

Because DartVoice is the input layer, building trust in ranked is paramount.

- Audio fingerprinting against the player's stated input pattern (verifies a human is calling, not a bot generating PCM).
- Throw-rhythm heuristics (statistically improbable visit timings get flagged).
- Optional opt-in webcam verification for high-stakes brackets.
- Server-side replay log of every score event so disputes can be reviewed.

The local clients act as the automated referee, preventing "keyboard typing" scores.

---

## Implementation status

| Phase | Scope | Status |
|---|---|---|
| 1 — Database | `011_ranked_mode.sql` (tables, indexes, RLS), MMR utility helpers | 🟡 Migration drafted, not yet applied |
| 2 — Edge functions | `ranked-queue`, `ranked-match-result`, realtime subscriptions | ⬜ Not started |
| 3 — UI | Ranked tab in `dartvoice-dashboard.html`, queue UI in `web-app.html`, pre/post-match screens | ⬜ Not started |
| 4 — Leaderboards | `rankings.html` powered by Postgres views, top-500 + tier breakdowns | 🟡 Page exists as a placeholder |
| 5 — Anti-cheat | Audio + rhythm heuristics, dispute review tooling | ⬜ Future |
| 6 — Seasons | Soft Elo reset, season cosmetic rewards, end-of-season leaderboard snapshots | ⬜ Future |

Detailed file-by-file plan is in [`ranked_mode_implementation_plan.md`](../ranked_mode_implementation_plan.md). When ranked Phase 1 ships, update [01_GENERAL_OVERVIEW.md](./01_GENERAL_OVERVIEW.md) and [README.md](../README.md) accordingly.

---

## Why this matters strategically

Ranked mode converts DartVoice from a **utility** ("scores your darts") into a **destination** ("where you come to play"). That transition unlocks:

- **Daily-active engagement** instead of session-based — players will queue every evening to climb.
- **Network effects** — every new ranked player improves matchmaking quality for the rest.
- **Defensibility** — Elo histories and rank prestige are extremely sticky; they're not portable to a competing app.
- **A fresh top-of-funnel** — "compete globally from your garage" is a different (and more emotionally compelling) hook than "auto-score your practice".
- **Sponsorship surface area** — a public global leaderboard is exactly the kind of property dart-brand sponsors (boards, flights, shafts, apparel) actually want to be near.

It is the single largest expansion of DartVoice's TAM (total addressable market) on the roadmap.
