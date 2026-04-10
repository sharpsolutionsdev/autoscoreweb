"""Generate a 1280x800 Chrome Web Store screenshot for DartVoice Launchpad."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1280, 800
BG = (8, 8, 10)
CARD = (17, 17, 20)
ACCENT = (204, 11, 32)
WHITE = (240, 240, 245)
MUTED = (110, 110, 130)
DARK = (37, 37, 48)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# Try to load nice fonts, fall back to default
font_dir = os.path.join(os.path.dirname(__file__), "..", "autoscore", "fonts")
try:
    font_title = ImageFont.truetype(os.path.join(font_dir, "UberMoveBold.otf"), 52)
    font_sub = ImageFont.truetype(os.path.join(font_dir, "UberMoveMedium.otf"), 28)
    font_body = ImageFont.truetype(os.path.join(font_dir, "UberMoveMedium.otf"), 22)
    font_small = ImageFont.truetype(os.path.join(font_dir, "UberMoveMedium.otf"), 18)
    font_big = ImageFont.truetype(os.path.join(font_dir, "UberMoveBold.otf"), 72)
    font_label = ImageFont.truetype(os.path.join(font_dir, "UberMoveBold.otf"), 16)
except Exception:
    font_title = ImageFont.load_default()
    font_sub = font_body = font_small = font_label = font_title
    font_big = font_title

# ── Background accent glow ──
for i in range(200):
    alpha = max(0, 30 - i // 5)
    r = int(204 * alpha / 30)
    g = int(11 * alpha / 30)
    b = int(32 * alpha / 30)
    draw.ellipse([W // 2 - 400 - i, 100 - i, W // 2 + 400 + i, 500 + i],
                 fill=(r, g, b))

# Redraw BG over most of it for subtle effect
draw.rectangle([0, 0, W, H], fill=BG + (0,))  # won't work, just leave glow

# ── Title area ──
draw.text((W // 2, 100), "DartVoice", fill=WHITE, font=font_big, anchor="mt")
draw.text((W // 2, 185), "Launchpad", fill=ACCENT, font=font_title, anchor="mt")
draw.text((W // 2, 240), "Voice-control any browser dart scorer", fill=MUTED, font=font_sub, anchor="mt")

# ── Three feature cards ──
card_y = 320
card_w = 340
card_h = 200
card_gap = 40
start_x = (W - 3 * card_w - 2 * card_gap) // 2

features = [
    ("🎤", "Speak Your Score", "Say \"sixty\" or \"treble twenty\"\nand DartVoice types it in.\nNo hands needed."),
    ("🎯", "Works Everywhere", "DartCounter, Nakka, and\nany dart scorer via the\nChrome extension overlay."),
    ("⚡", "10-Min Free Demo", "Try it instantly — no sign-up.\nSubscribe for unlimited use\nwith DartVoice Pro."),
]

for i, (icon, title, body) in enumerate(features):
    x = start_x + i * (card_w + card_gap)
    # Card background
    draw.rounded_rectangle([x, card_y, x + card_w, card_y + card_h], radius=16, fill=CARD)
    # Accent top line
    draw.rectangle([x + 16, card_y, x + card_w - 16, card_y + 3], fill=ACCENT)
    # Title
    draw.text((x + card_w // 2, card_y + 40), title, fill=WHITE, font=font_body, anchor="mt")
    # Body text (multiline — no anchor, manually center)
    lines = body.split("\n")
    ly = card_y + 80
    for line in lines:
        tw = draw.textlength(line.strip(), font=font_small)
        draw.text((x + card_w // 2 - tw // 2, ly), line.strip(), fill=MUTED, font=font_small)
        ly += 24

# ── Bottom bar — supported sites ──
bar_y = 580
draw.text((W // 2, bar_y), "Works with", fill=MUTED, font=font_small, anchor="mt")

sites = ["DartCounter.net", "Nakka.com", "Any Dart Scorer"]
site_gap = 260
sx = W // 2 - site_gap
for i, site in enumerate(sites):
    cx = sx + i * site_gap
    # Pill background
    tw = draw.textlength(site, font=font_body)
    pill_w = int(tw) + 40
    draw.rounded_rectangle(
        [cx - pill_w // 2, bar_y + 35, cx + pill_w // 2, bar_y + 75],
        radius=20, fill=DARK
    )
    draw.text((cx, bar_y + 55), site, fill=WHITE, font=font_body, anchor="mm")

# ── Footer ──
draw.text((W // 2, H - 60), "dartvoice.app", fill=ACCENT, font=font_sub, anchor="mt")
draw.text((W // 2, H - 25), "Free trial • No card required • Cancel anytime", fill=MUTED, font=font_small, anchor="mt")

# ── Save ──
out_path = os.path.join(os.path.dirname(__file__), "screenshot_store.png")
img.save(out_path, "PNG")
print(f"Saved: {out_path}")
print(f"Size: {img.size}")
