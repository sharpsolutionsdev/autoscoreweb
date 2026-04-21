# DartVoice Live-Game UI + Outreach Hardening TODO
*Status: Approved by user. Executing step-by-step.*

## 1. Database Migration [x]
- Create `supabase/migrations/012_claim_outreach_job.sql`

## 2. QA Tools [x]
- Create `tools/test-checkout.js`

## 3. Web App UI Updates [x]
- Update `web-app.html`: CSS, HTML placeholders, JS handlers + remove legacy

## 4. Extension Bridge [x]
- Update `chrome_extension/content.js`: Enhanced score observer

## 5. Outreach Worker [ ]
- Update `outreach-server/package.json`: Add deps
- Update `outreach-server/src/index.js`: RPC loop + retry

## 6. Extension Packaging Prep [ ]
- Verify manifest v2.1.6 + run PowerShell zip

## 7. Test & Deploy [ ]
- Apply Supabase migration
- `npm install` + `pm2 restart` worker
- Manual QA (camera persistence, checkout routes)
- `node tools/test-checkout.js`
- Zip + CWS upload

**Current Step: 5/7**
