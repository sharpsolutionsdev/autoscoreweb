# DartVoice Multi-Plan Checkout Fix
Current dir: c:/Users/vrynw/Documents/GitHub/dartvoice/testomg
Live site: dartvoice.app

## Plan Summary
- Wire 3 Stripe payment links (monthly/6mo/12mo) via URL plan= param
- Auto-redirect thanks.html → dashboard  
- Ensure trial confirmation + emails (already working)

## Steps [4/7]
### 1. ✅ Create TODO.md [DONE]
### 2. ✅ Edit login.html: Forward plan= param to dashboard [DONE]
### 3. ✅ Edit dartvoice-dashboard.html: Read plan= & select correct payment link [DONE]
### 4. ✅ Edit thanks.html: Add 4s auto-redirect to dashboard [DONE]
### 5. Test locally: index.html → plan button → login → dashboard → correct Stripe popup
### 6. Verify live: dartvoice.app → pricing → flow + thanks redirect
### 7. [attempt_completion]
