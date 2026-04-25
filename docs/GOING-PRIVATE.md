# Going private — exact steps

Everything that could break when the repo is flipped to private has been
re-platformed off of GitHub Releases.

## What's already wired

- Cloudflare R2 bucket `dartvoice-releases` exists in the EU/ENAM region
  on account `0585d1caa30b50424399443d3fc46628`.
- All three CI workflows (`build-android.yml`, `build-windows.yml`,
  `build-extension.yml`) now push their artefacts to R2 via the
  Cloudflare REST API. They keep publishing to GitHub Releases too, so
  there's a fallback while you're cutting over.
- New `seed-r2.yml` workflow: one-click pulls the current release
  binaries from GitHub Releases and uploads them to R2, plus enables
  the managed public hostname so they're directly downloadable.

## What you need to do (one time, ~3 min)

### 1. Create a Cloudflare API token

<https://dash.cloudflare.com/profile/api-tokens> → **Create Token** →
**Custom token**:

| Permission | Value |
|---|---|
| Account → Workers R2 Storage | **Edit** |
| Account → Account Settings | **Read** *(only needed if you skip step 3 and let CI bind the custom domain)* |

Token TTL: leave default. Account resources: include the
`Sharpsolutionsdev@gmail.com's Account` only. **Continue → Create token**
and copy the value (you only see it once).

### 2. Add the token as a repo secret

<https://github.com/sharpsolutionsdev/autoscoreweb/settings/secrets/actions>
→ **New repository secret**:

- Name: `CLOUDFLARE_API_TOKEN`
- Value: paste the token from step 1.

### 3. Run the seed workflow

<https://github.com/sharpsolutionsdev/autoscoreweb/actions/workflows/seed-r2.yml>
→ **Run workflow** (branch: working).

The job will:

1. Verify the token works.
2. Toggle the R2 bucket's managed-public hostname on — this gives you a
   `https://pub-<HASH>.r2.dev` URL. The hostname is printed at the top
   of the **Enable managed public hostname on R2 bucket** step.
3. Pull the current `DartVoice.apk` + `DartVoice_Setup.exe` from your
   public GitHub Releases and PUT them into the bucket.
4. Verify each download URL returns HTTP 200.

Copy the `R2_PUBLIC_HOST` value from the logs (looks like
`pub-9f8e7d…r2.dev`) and paste it back to me. I'll do the URL swap.

### 4. (Optional but cleaner) Bind a custom subdomain

Instead of the long `pub-….r2.dev` URL you can use `releases.dartvoice.app`.

<https://dash.cloudflare.com/0585d1caa30b50424399443d3fc46628/r2/default/buckets/dartvoice-releases/settings>
→ **Public access** → **Connect Domain** → enter `releases.dartvoice.app`.
Cloudflare will auto-create the proxied CNAME because `dartvoice.app` is
already on your account.

After it shows "Connected", paste that custom hostname back to me.

### 5. I cut the site over

Once you give me the public hostname (either `pub-…r2.dev` or
`releases.dartvoice.app`), I do the URL swap in `dartvoice-dashboard.html`
+ `web-app.html` in one commit.

### 6. Flip the repo private

<https://github.com/sharpsolutionsdev/autoscoreweb/settings> →
**Danger Zone** → **Change visibility** → **Make private**.

GitHub Pro keeps the Pages site working for `dartvoice.app` (no DNS
change needed). Release downloads now come from R2, which is fully
public. Site continues to load on a fresh device with no cached state.

### 7. Verify

Open `https://dartvoice.app` in a private tab on a device that has
never visited it:

- Landing page + nav images render
- Sign-in OTP flow works (Supabase, untouched)
- Dashboard download buttons (Windows + APK) → start downloading
- Web app loads, scorer iframe loads
- Streaming overlays appear for ambassador/admin profiles

If anything 404s: paste it to me and I'll fix.

## Rollback

If something breaks after you flip private, you can re-enable visibility
from the same settings page and the GitHub Pages + Releases URLs come
right back. The R2 mirror keeps working in either mode — it's purely
additive.
