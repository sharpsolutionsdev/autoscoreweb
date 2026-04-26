# Repository Audit & Cleanup Plan

*Internal Staff Document. Generated: April 2026.*

A walk-through of every folder/file at the repo root, flagging what is unused, what is orphaned, what is shipped-but-undocumented, and what needs structural cleanup. Use this as the source for the cleanup PR mentioned in [TODO.md](../TODO.md).

> **Rule of thumb before deleting anything:** `git grep -F "<filename>"` first. Files referenced from HTML, JS, Python, or other Markdown are *load-bearing*. The audit below has done that step for the obvious candidates.

---

## 1. Definitely safe to delete

These have no incoming references anywhere in the codebase.

| Path | Why it can go |
|---|---|
| `f7b44dca-f619-4e26-b104-8b610ee6d0d1.html` | UUID-named file — leftover from a tool export. No references in any HTML/JS. |
| `gamedcifno.html` | Typo'd filename. No references. |
| `Recording 4_21_2026 at 5_32_20 AM.js` | Browser-recorded macro left at root. Not imported anywhere. |
| `edit score.json` | Chrome DevTools "Recorder" export (`{"type": "setViewport"}` etc.). Not loaded at runtime. |
| `startbreak.json` | Same as above — DevTools recording. |
| `DartVoice_Visual_Formula_202604240042.jpeg` | Generated brand asset, no references. Move to `assets/media/` if needed. |
| `Sharp_Monogram_Equalizer_202604240038.jpeg` | Same. |
| `image.png`, `image copy.png` | `process_logo.py` reads `image copy.png`; `image.png` itself is unreferenced. The logo pipeline should source from `assets/` instead. |
| `chrome_extension_2.1.4_fixed.zip` | Old extension build artifact. |
| `chrome_extension_live_ui.zip` | Old extension build artifact. |
| `chrome_extension_v2.1.6.zip` | Old extension build artifact. |
| `chrome_extension_v2.1.7.zip` | Old extension build artifact. CI now uploads to R2 — these zips don't need to be in git. |
| `launchpad.zip`, `launchpadnew.zip` | Older extension packaging attempts. |
| `build/tmp/` | Gradle scratch directory (~40 sub-folders). Already-built Android artifacts. Add to `.gitignore`. |
| `.gradle/`, `.tmp/`, `.project` | Eclipse / Gradle metadata. Should be in `.gitignore`. |

### Suggested commit
```powershell
git rm "f7b44dca-f619-4e26-b104-8b610ee6d0d1.html" `
       "gamedcifno.html" `
       "Recording 4_21_2026 at 5_32_20 AM.js" `
       "edit score.json" `
       "startbreak.json" `
       "DartVoice_Visual_Formula_202604240042.jpeg" `
       "Sharp_Monogram_Equalizer_202604240038.jpeg" `
       "image.png" "image copy.png" `
       "chrome_extension_2.1.4_fixed.zip" `
       "chrome_extension_live_ui.zip" `
       "chrome_extension_v2.1.6.zip" `
       "chrome_extension_v2.1.7.zip" `
       "launchpad.zip" "launchpadnew.zip"
git rm -r build/tmp .gradle .tmp .project
```

Then add to `.gitignore`:
```
build/tmp/
.gradle/
.tmp/
.project
chrome_extension*.zip
launchpad*.zip
```

---

## 2. Keep — actually load-bearing (do **not** delete)

I'd flagged these initially as suspicious. They are in fact in use.

| Path | Used by |
|---|---|
| `u.html` | Public profile page — linked from `dartvoice-dashboard.html` (`/u.html?u=…`) and `rankings.html` (`u.html?id=…`). |
| `assets/media/`, `dc-logo.png`, `apple-touch-icon.png`, `favicon*` | Site icons & OG images. |
| `prototypes/social-media-gen.html` | Source of share-asset templates referenced in [04_ADVERTISING_AND_MARKETING.md](./04_ADVERTISING_AND_MARKETING.md). |
| `prototypes/appuiprototype.html`, `designhub.html` | Design refs (not deployed but useful for AI-translation workflow). |

---

## 3. Investigate / decide

| Path | Question | Recommendation |
|---|---|---|
| `migrations/` (root, 18 files) **vs** `supabase/migrations/` (3 files) | Two parallel migration trees with **different content**. Root has app schema (subscriptions, ambassador, ranked). `supabase/` has CRM-only. They have diverged. | **Pick one canonical home and merge.** The Supabase CLI expects `supabase/migrations/`. Move all of `migrations/*.sql` into `supabase/migrations/`, sort by intended apply order, and renumber. This is a high-priority data-integrity item. |
| `extension/` (root, contains only `dartcounter-inject.js`) | INJECTOR.md says it should hold `manifest.json + dartcounter-inject.js`. Only the JS exists. | Either: (a) remove this folder and update INJECTOR.md, or (b) restore the missing `manifest.json`. The real, shipping extension is in `chrome_extension/`. |
| `dartvoice_unzipped/handoff/` | Historical handoff content (Creator CRM HTML, Outreach Email template, PROMPTS.md, README.md). Some of it has been superseded by `admin.html`. | Keep `Creator Outreach Email.html` if the outreach worker still references its template. Archive the rest into `docs/superpowers/legacy-handoff/` or delete after one final review. |
| `chrome_extension/_metadata/` | Chrome auto-generated. | Already gitignored — make sure it's truly out of git via `git ls-files | rg _metadata`. |
| `node_modules/` (root) | A `node_modules/` at the repo root suggests there's a `package.json` doing something at root. | Already gitignored. Confirm `package.json` at root only references dev tooling; otherwise consider moving it under `tools/`. |
| `downloads/` | Empty/legacy folder from when binaries were committed. | Either repurpose as a redirect HTML stub pointing at `releases.dartvoice.app`, or delete. |
| `build/` | Top-level build dir. The `build/tmp/` is junk; check if anything else lives here. | Delete the whole `build/` if no CI step writes here. |

---

## 4. Structural improvements (broader cleanup)

These aren't deletes — they're moves/refactors that would significantly improve the repo's legibility for new contributors.

### 4.1 Group root-level marketing pages

Currently 25+ `.html` files sit at the repo root. Suggested layout:

```
/                       index.html, 404.html, robots.txt, sitemap.xml, CNAME
/site/marketing/        how-it-works.html, contact.html, privacy.html, terms.html,
                        cookies.html, thanks.html, welcome.html, guide.html,
                        creator-portal.html, ranked.html, rankings.html, referral.html,
                        checkout-cancelled.html, apk-gate.html
/site/app/              dartvoice-dashboard.html, web-app.html, web-app-mobile.html,
                        login.html, u.html
/site/admin/            admin.html, admin.js
```

Risk: GitHub Pages URL paths change. Mitigate with a one-time redirect map in `404.html` (which already routes unknown paths client-side).

### 4.2 Co-locate JS with HTML or move it under `js/`

`cookies.js`, `dv-currency.js`, `dv-discount.js`, `dv-presence.js`, `dv-welcome.js`, `theme.js`, `admin.js` all live at root. Move under `js/` (alongside `css/` and `components/`).

### 4.3 Move root utilities

`process_logo.py`, `update_logos.py`, `update_special_logos.py` → `tools/logos/`.

### 4.4 Stop committing zips and binaries

Add to `.gitignore`:
```
*.zip
*.exe
*.apk
*.aab
*.jpeg     # only if our brand JPEGs live in assets/ instead
```
…then re-add intentionally to `assets/` if needed.

### 4.5 CI improvements

- **Link checker** — run `lychee` (or `markdown-link-check`) over the whole repo on every PR. Catches dead `dartvoice.app` URLs and dead R2 links instantly.
- **R2 release smoke-test** — after `build-windows.yml` and `build-android.yml` upload, do a `curl -I` against `releases.dartvoice.app/...` and fail the workflow if the binary 404s.
- **Migration linter** — fail CI if a migration filename in `supabase/migrations/` skips a number or has a name collision.
- **Dead-code sweep** — scheduled monthly job that runs `git grep` for every HTML file at root and surfaces unreferenced ones.

### 4.6 Documentation upkeep

- Add a single date-stamped *Refresh Log* to [docs/INDEX.md](./INDEX.md): every time someone updates a doc, add a line `YYYY-MM-DD — file — change`. Cheap historical record.
- Convert the `Mermaid` Gantt in [08_GROWTH_AND_ROADMAP.md](./08_GROWTH_AND_ROADMAP.md) into a screenshot in `assets/media/` once the dates lock in, so it renders even outside Mermaid-aware viewers.

### 4.7 Naming consistency

- Lowercase, hyphen-separated, no spaces. `edit score.json` (note the space) is a smell — anything with a space in the name should be flagged.
- The chrome zips with embedded version numbers (`_v2.1.6.zip`) are an anti-pattern; CI artifact storage in R2 replaces them.

---

## 5. Suggested execution order

1. **Backup branch first**: `git checkout -b chore/repo-audit-cleanup`.
2. Run the deletes in §1 in a single commit titled `chore: prune unused root files`.
3. Apply §3 — start with the **migrations reconciliation** (highest risk, highest value).
4. Apply the directory restructure in §4.1–4.3 in one commit; verify GitHub Pages deploys without breaking links.
5. Add the `.gitignore` rules from §4.4.
6. Add the CI checks from §4.5 in a follow-up PR.

After this passes, the repo is in a state where a new collaborator could land on it cold and orient themselves in under 30 minutes — which is the whole point.
