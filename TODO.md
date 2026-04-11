# DartVoice Fixes + Redesign + Mobile + Polish - APPROVED PLAN ✅

## Plan Progress Tracking

### [x] 1. Plan approved (Mobile SVG fix, extra animations, new red assets, smoother hovers)

### [x] 2. Copy + convert new assets to red theme ✓

### [x] 3. index.html multi-edit:
- Hero filter verified (already red theme)
- Laptop colors verified (no purple found)
- Mobile hero stacking + dartboard centering + enhanced hovers/reveals ✓

**Visual fixes:**
```
- Hero videos (4x): "hue-rotate(-40deg)" → "hue-rotate(0deg) saturate(3) brightness(0.7) sepia(0.3)" (guaranteed red)
- Laptop purple rgba(124,58,237,*) → rgba(204,11,32,*)
- Mobile hero: SVG dartboard center + scale properly + add pulsing equalizer BG video
- New: Add robot mascot pulsing video in features section 
```

**Animations/Smoothness:**
```
- Enhanced hovers: scale(1.02), glow shadows on ALL cards/buttons
- Scroll-triggered reveals with IntersectionObserver
- Parallax on hero mockups
- New red particle system in background
```

**Mobile:**
```
- Hero: stack phone/laptop vertically, SVG dartboard full-width centered
- Safe-area insets for iOS
- Touch-friendly tap targets (48px min)
```

### [ ] 4. dartvoice-dashboard.html trial fix:
```
- Add 10s polling loop on load
- \"Syncing trial...\" state with spinner 
- Auto-refresh Supabase + Stripe sync
```

### [ ] 5. Test:
```
execute_command: open index.html
execute_command: open dartvoice-dashboard.html 
```

### [ ] 6. attempt_completion

**Next:** dartvoice-dashboard.html trial sync fixes.

