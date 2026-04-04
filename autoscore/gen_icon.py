#!/usr/bin/env python3
"""Generate DartVoice app icon (512x512 PNG).

Reproduces the bullseye + audio-wave logo from social-media-gen.html.
Requires Pillow:  pip install Pillow
"""
import math, sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow required:  pip install Pillow")
    sys.exit(1)

SIZE = 512
CX, CY = SIZE // 2, SIZE // 2

# Palette (from brand kit)
BG      = (8, 8, 10)
WIRE    = (37, 37, 48)       # #252530
RING2   = (110, 110, 130)    # #6E6E82
ACCENT  = (204, 11, 32)      # #CC0B20
WHITE   = (240, 240, 245)    # #F0F0F5

img  = Image.new('RGBA', (SIZE, SIZE), (*BG, 255))
draw = ImageDraw.Draw(img)

# ── Outer ring (r=200, stroke ~12) ───────────────────────────────────────
for t in range(12):
    r = 200 - t
    draw.ellipse([CX - r, CY - r, CX + r, CY + r], outline=WIRE)

# ── Middle ring (r=120, stroke ~10) ──────────────────────────────────────
for t in range(10):
    r = 120 - t
    draw.ellipse([CX - r, CY - r, CX + r, CY + r], outline=RING2)

# ── Centre dot (filled, r=55) ───────────────────────────────────────────
draw.ellipse([CX - 55, CY - 55, CX + 55, CY + 55], fill=ACCENT)

# ── Audio wave arc (right side, white, thick) ────────────────────────────
# SVG: path d="M 65 25 Q 85 50 65 75"  (scaled to 512)
# Approximate with a thick arc on the right
for offset in range(-8, 9):
    for i in range(200):
        t = i / 199.0
        angle = math.radians(-55 + t * 110)  # arc from -55 to +55 degrees
        r = 160 + offset * 0.9
        x = CX + r * math.cos(angle)
        y = CY - r * math.sin(angle)
        draw.point((int(x), int(y)), fill=WHITE)

# Smooth the arc by drawing thick lines along it
arc_pts = []
for i in range(100):
    t = i / 99.0
    angle = math.radians(-50 + t * 100)
    r = 160
    x = CX + r * math.cos(angle)
    y = CY - r * math.sin(angle)
    arc_pts.append((x, y))

for i in range(len(arc_pts) - 1):
    draw.line([arc_pts[i], arc_pts[i + 1]], fill=WHITE, width=16)

# ── Round corners (mask with rounded rectangle) ─────────────────────────
CORNER = 90
mask = Image.new('L', (SIZE, SIZE), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([0, 0, SIZE, SIZE], radius=CORNER, fill=255)
img.putalpha(mask)

out = 'icon.png'
img.save(out, 'PNG')
print(f"Saved {out} ({SIZE}x{SIZE})")
