# Stock Photos — Credits & Usage

All photos in `stock/photos/` are sourced from **Wikimedia Commons** under
public-domain or Creative Commons licenses that permit commercial use.
Where a license requires attribution, attribute when publishing the final ad.

| File | Source | License | Description |
|---|---|---|---|
| `darts-gameplay.jpg` | [Wikimedia](https://commons.wikimedia.org/wiki/File:Darts_gameplay.jpg) | CC / PD | Players mid-game |
| `darts-in-board.png` | [Wikimedia](https://commons.wikimedia.org/wiki/File:Darts_in_board.png) | CC / PD | Three darts in dartboard |
| `pub-dartboard.jpg` | [Wikimedia](https://commons.wikimedia.org/wiki/File:The_Jolly_Tanners_dartboard_Staplefield_West_Sussex.jpg) | CC | Pub dartboard, English pub setting |
| `steeldart-board.jpg` | [Wikimedia](https://commons.wikimedia.org/wiki/File:Dartscheibe_f%C3%BCr_Steeldarts.jpg) | CC | Sisal steel-tip board, clean shot |
| `darts-oche.jpg` | [Wikimedia](https://commons.wikimedia.org/wiki/File:Darts_oche.jpg) | CC | Throwing line / oche setup |
| `exeter-dartboard.jpg` | [Wikimedia](https://commons.wikimedia.org/wiki/File:Dartboard_(Exeter_2016).jpg) | CC | Wall-mounted board, atmosphere |
| `wall-mounted-board.jpg` | [Wikimedia](https://commons.wikimedia.org/wiki/File:Dart_Wall.jpg) | CC | Wall-mount setup |
| `pixabay-262438.jpg` | [Wikimedia](https://commons.wikimedia.org/wiki/File:Pexels-pixabay-262438.jpg) | CC0 | High-res gameplay scene |
| `fleches-jeu.jpg` | [Wikimedia](https://commons.wikimedia.org/wiki/File:Jeu_de_fl%C3%A9chettes.jpg) | CC | Game setup, board + accessories |
| `electronic-board.jpg` | [Wikimedia](https://commons.wikimedia.org/wiki/File:Cible_%C3%A9lectronique_de_jeu_de_fl%C3%A9chette_(29295279995).jpg) | CC | Electronic board (ignore for steel-tip prompts) |

## Recommended pairing with Flow prompts

| Stock photo | Best for prompts |
|---|---|
| `darts-in-board.png`, `steeldart-board.jpg` | **23A Slow-mo dart impact**, **23B Three-dart combo**, **1C Dart-strike reveal**, any "darts in T20" cutaway |
| `pub-dartboard.jpg`, `exeter-dartboard.jpg` | **2A Stop chalking** (pub atmosphere), **10B Day in the life**, **10D Comedy chalkboard fail** |
| `darts-oche.jpg` | **23C Hand throwing macro** (reference for throwing-line POV), **2B POV** |
| `darts-gameplay.jpg`, `fleches-jeu.jpg` | **4A The Anthem hero ad** (real-world player establishing shots) |
| `pixabay-262438.jpg` | General establishing shot, hero ad B-roll |
| `wall-mounted-board.jpg` | **17 App Store preview** (environmental shot), endcards |

## How to use in Flow

For any prompt where you want **real-world dartboard texture** (sisal fiber,
real lighting, real darts in real wood), drop one of these stock photos
into the references panel **alongside** your DartVoice brand mood board.

Flow will blend the two: brand aesthetic + authentic darts texture.

**Example combination for Prompt 23A (slow-mo dart impact):**
1. `stock/photos/darts-in-board.png` (real impact texture)
2. `brand/palette.png` (color grade target)
3. `moodboards/mood-gameplay.png` (overall vibe)

That 3-reference combo gives Flow: real darts + your colors + your vibe.

## What's missing (and why)

- **Slow-mo throwing video clips** — Wikimedia doesn't host these; would need Pexels API or a manual download from [pexels.com/search/videos/darts](https://www.pexels.com/search/videos/darts/)
- **Hand-holding-dart macro** — phone-shoot this yourself in 2 minutes for best results
- **Pub interior video** — Pexels has good ones; manual download

If you want the video clips too, easiest path:
1. Get a free Pexels API key (60 seconds at [pexels.com/api](https://www.pexels.com/api/))
2. Drop the key in a file or env var
3. Tell me — I'll write a script that fetches 5-10 specific clips into `stock/videos/`
