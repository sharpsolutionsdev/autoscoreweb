# Going private — exact steps

Everything that could break when the repo is flipped to private has been
re-platformed to services that don't care about repo visibility.

## What's already been done in code

- Supabase Storage public `releases` bucket created (idempotent migration
  in `supabase/migrations/…create_public_releases_bucket.sql`).
- All three workflows (`build-android.yml`, `build-windows.yml`,
  `build-extension.yml`) now push their artefacts to Supabase Storage in
  addition to their existing destinations.
- All download links on the site (`dartvoice-dashboard.html`, `web-app.html`)
  point at the Supabase public URLs. GitHub Releases URLs are no longer
  referenced by the site.

## What you need to do (manual, one-time)

### 1. Set the `SUPABASE_SERVICE_ROLE_KEY` secret on the repo

1. Grab the key: <https://supabase.com/dashboard/project/poyjykgqsvgimssbhsuz/settings/api>
   → copy the **service_role** key (starts with `eyJ…`, marked secret).
2. Add it to the repo: <https://github.com/sharpsolutionsdev/autoscoreweb/settings/secrets/actions>
   → **New repository secret** → name `SUPABASE_SERVICE_ROLE_KEY`, paste the value.

CI uploads will start working on the next build. Without this secret, CI
will skip the upload step but not fail the build (safe default).

### 2. Seed the current binaries into Supabase Storage

Until the next CI build runs, the download links point at URLs that don't
exist yet. Seed them once from your machine:

```bash
# WSL / Git Bash / macOS
export SUPABASE_SERVICE_ROLE_KEY=eyJ…  # same key as above
bash scripts/upload-releases-to-supabase.sh
```

This pulls the latest public `DartVoice.apk` + `DartVoice_Setup.exe` from
GitHub Releases and uploads them to Supabase, plus the extension zip from
`downloads/`.

### 3. Move site hosting off GitHub Pages

The repo has a `CNAME` file → `dartvoice.app` is currently served via
GitHub Pages. Free-plan GitHub Pages does NOT work on private repos, so
we have to move the site first.

Fastest migration path — **Cloudflare Pages** (free, built on your existing
Cloudflare account):

1. <https://dash.cloudflare.com/> → Workers & Pages → **Create** → Pages →
   **Connect to Git** → select this repo. (Requires you to authorize the
   Cloudflare Pages GitHub app; one click.)
2. Build settings:
   - Framework preset: **None**
   - Build command: (leave empty)
   - Build output directory: `/`
3. **Save and deploy** — takes ~30 s. You'll get a `*.pages.dev` URL.
4. In the Pages project → **Custom domains** → add `dartvoice.app` and
   `www.dartvoice.app`. Cloudflare will tell you which DNS record to
   update (or create it automatically if the domain is already on
   Cloudflare DNS).
5. Wait for the `*.pages.dev` site to serve the latest deploy, then verify
   `https://dartvoice.app` is still healthy.

Alternative: **Vercel** or **Netlify** — same shape, both free, both
private-repo friendly.

### 4. Disable the old GitHub Pages deploy

Once Cloudflare Pages is live at `dartvoice.app`:

1. <https://github.com/sharpsolutionsdev/autoscoreweb/settings/pages>
   → set **Source** to *None*.
2. Delete the `CNAME` file from the repo root (or leave it, doesn't hurt).

### 5. Flip the repo private

<https://github.com/sharpsolutionsdev/autoscoreweb/settings> →
scroll to **Danger Zone** → **Change visibility** → **Make private**.

### 6. Verify everything still works

- `https://dartvoice.app` loads (Cloudflare Pages)
- `https://dartvoice.app/web-app` loads
- APK download button in the dashboard downloads a valid APK
- Windows installer button downloads a valid `.exe`
- Sign-in + OTP flow still works (unchanged — Supabase-side)
- Admin panel loads stats (unchanged — Supabase Edge Function)

If any download 404s, it means Step 2 wasn't run — do that.

## Rollback

If anything goes sideways, you can re-enable the repo publicly from the
same settings page and GitHub Pages will resume automatically. The
Supabase Storage uploads are additive — they never replace GitHub's
copy of the binaries, so the old URLs keep working too.
