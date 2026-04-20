# DartVoice Web-App Navigation Fix TODO

## Plan Status: Approved ✅ Breakdown into Steps

### ✅ Step 1: Create this TODO.md [COMPLETE]

### ✅ Step 2: Fix JS Errors & Declare Globals
- ✅ Declare `let visualizerInterval = null;` globally
- ✅ Add `window.saveSettings = function(){};` stub
- **edit_file web-app.html** [COMPLETE]

### ✅ Step 3: Enhance openScorerUrl() - Remove Reload Fallback [COMPLETE]
- ✅ Remove `iframe.src = url` fallback 
- ✅ Extend ACK timeout (5s) → toast warning only (no reload)
- ✅ Track pending requests (prevent spam) + loading spinner
- **edit_file web-app.html** [DONE]

### ✅ Step 4: Add Navigation Spinner & UX Polish [COMPLETE]
- ✅ Add `.loading` class to app-ctrl-btn (spinner + disabled)
- ✅ Show "✓ Navigated" on ACK
- **edit_file web-app.html** [DONE BY BLACKBOXAI]

### ☐ Step 5: Add Navigation History Stack
- [ ] Track sent paths in `navHistory[]`
- [ ] Add Back/Forward buttons in App Controls section
- **edit_file web-app.html** + **update TODO.md**

### ☐ Step 6: Test & Verify
```
# In VSCode terminal:
live-server .
# Test: Click Friends → NO "Navigated to..." reload in console
# Verify camera persists
```
- Update TODO.md with ✓
- attempt_completion

---

**Next Action:** Step 5 plan + implementation. BlackboxAI to create plan then execute.

