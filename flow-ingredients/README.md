# DartVoice — Flow Ingredient Pack

A drop-in asset library for Google AI Ultra (Flow) and any image/video AI tool.
The goal: feed the AI your **actual** brand and product so output looks like
DartVoice, not generic SaaS.

## What's in here

```
flow-ingredients/
├── screenshots/         76 PNGs — every customer page, desktop + mobile, hero + full
├── brand/
│   ├── palette.png      Color tokens reference
│   ├── typography.png   Type specimen (Barlow Condensed + Plus Jakarta)
│   └── logo-cards.png   Logo on dark + light backgrounds
├── crops/               UI region crops (hero band, square 1:1, feature band)
├── mockups/             Phone + laptop mockup composites (8 phones + trio + laptop)
├── moodboards/          Theme mood boards (gameplay, stats, compete, events, onboard, brand)
├── flow-prompts.md      75+ ready-to-paste shot prompts
└── copy-bank.md         Taglines, hooks, captions, VO scripts, voice rules
```

## Brand DNA (paste into every Flow prompt)

```
Brand: DartVoice — voice-controlled darts auto-scorer.
Palette: red #CC0B20 primary, #08080A near-black, #F0F0F5 off-white,
         #9E9EB0 muted, gradients of brand-rgb at low opacity.
Type:    Barlow Condensed Italic 900 for display (caps, scoreboards),
         Plus Jakarta Sans 500/700 for body & UI.
Mood:    cinematic, modern, premium-sport. Apple/Linear/Nothing energy.
         Matte black surfaces, soft red glow, Barlow scoreboard typography,
         shallow depth of field, 24fps, deliberate camera moves.
Avoid:   stock-art darts cliches, dartboard close-ups with cartoon graphics,
         neon-arcade vibes, Comic Sans, color noise, generic "tech" aesthetics.
```

## How to use this in Flow

1. **Open Flow → new project → "References" panel**
2. Drag in 3–8 PNGs from this pack per shot:
   - Always include `brand/palette.png` + `brand/typography.png`
   - Add 1–3 `screenshots/` PNGs that match the shot subject
   - Add `brand/logo-cards.png` for endcards
3. Paste a prompt from `flow-prompts.md`
4. Generate, review, regenerate. Pin your favorite shot. Move to next.
5. Stitch shots in Flow's timeline. Add audio in Flow or in your editor.

## How to crop (optional but powerful)

Open any screenshot in Photos / Preview / Photoshop and crop to:
- **Just the score widget** — for "live scoring" cutaways
- **Just the dashboard charts** — for "track your stats" beats
- **Just the hero headline** — for typography-driven shots
- **Just a single button** — for product-detail B-roll

Save into `flow-ingredients/crops/` so you can reference them per-shot.

## Recommended Flow shot lengths

| Use case | Length | Aspect |
|---|---|---|
| Logo sting | 2–3s | 16:9 |
| Instagram Reel / TikTok | 9–15s | 9:16 |
| Instagram feed post (still or 4s loop) | 4s | 1:1 or 4:5 |
| Hero ad (web/YouTube pre-roll) | 15–30s | 16:9 |
| App Store / Play Store preview | 15–30s | 9:16 |

## Output checklist for "premium" feel

- ✅ 24fps (or 23.976) — never 30fps
- ✅ Camera moves slowly. Dolly, push, slide. No handheld unless intentional.
- ✅ One subject per shot. One color accent per shot.
- ✅ Negative space. Don't fill the frame.
- ✅ Type animates in *after* the camera settles, not during.
- ✅ Music drives cuts; never cut faster than the beat.
