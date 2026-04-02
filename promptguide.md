🎨 DartVoice: App Design & UI Engineering Guide

This document is your technical blueprint for upgrading the visual frontend of your Windows (dartvoice_v2.py) and Android (dartvoice_android.py) applications.

The Golden Rule of UI Engineering: Always provide your AI with the current python file, and explicitly tell it not to touch the SpeechListener, VideoScorerThread, or _billing_gate() logic.

💻 WINDOWS: Desktop App Upgrades

The desktop app uses customtkinter. It needs to feel like a premium gaming utility (like Discord or OBS), rather than a basic Python script.

1. The "Command Center" Layout

Goal: Move from a vertical stacked layout to a wide, 3-column landscape dashboard.

How to execute: Open dartvoice_v2.py in your AI editor and use this prompt:

Prompt:
I want to completely refactor the UI layout of my Windows app in dartvoice_v2.py to match a modern "Command Center" landscape design.

Rules:

DO NOT touch any backend logic, the SpeechListener thread, the CHECKOUT dictionary, or the _billing_gate() functions.

ONLY rewrite _build_content(self) and _redraw_score(self).

Specs (Using CustomTkinter):

Change the initial window geometry to 1024x600.

Replace the .pack() layout with a 3-column .grid() layout.

Column 0 (Weight 1): "History" - A dark scrollable sidebar showing the session history.

Column 1 (Weight 2): "Main Stage" - The center area. It must feature a massive font for the remaining score, the live checkout route directly beneath it, and the "START LISTENING" button centered at the bottom.

Column 2 (Weight 1): "Stats & Settings" - A dark sidebar showing Session Avg, Darts Thrown, and quick settings.

2. The "Streamer Widget" (Picture-in-Picture)

Goal: Let users shrink the app down to a tiny floating pill that sits over DartCounter Web or OBS.

How to execute: Provide dartvoice_v2.py and use this prompt:

Prompt:
I want to replace the basic _open_ingame window in dartvoice_v2.py with a sleek, borderless "Picture-in-Picture" Streamer Widget.

Rules & Specs:

Update the _igw Toplevel window to use overrideredirect(True) to make it completely borderless.

Use wm_attributes('-transparentcolor', BG) to make the background perfectly transparent, leaving only the UI elements visible.

Create a sleek floating pill shape (using a CTkFrame with high corner_radius). Inside it, display the remaining score, the checkout route, and a pulsing mic icon.

Bind <ButtonPress-1> and <B1-Motion> to the widget so the user can click and drag this borderless overlay anywhere on their screen.

Ensure it stays -topmost at all times.

3. Ghost Mode (Opacity Controls)

Goal: Allow users to make the main window semi-transparent so they can see other apps behind it.

How to execute: Provide dartvoice_v2.py and use this prompt:

Prompt:
I want to add a "Ghost Mode" to dartvoice_v2.py.

Tasks:

In _open_settings, add a CTkSlider for "Window Opacity" ranging from 0.3 to 1.0.

Bind this slider to update self.attributes('-alpha', value) dynamically in real-time as the user drags it.

Add a CTkCheckBox for "Always on Top" that toggles self.attributes('-topmost', True/False).

Ensure these two new settings are saved to dartvoice_config.json and automatically applied in __init__ on startup.

📱 ANDROID: Mobile App Upgrades

The Android app uses Kivy. Because Kivy apps can feel a bit rigid out of the box, we need to inject animations, haptics, and ergonomic layouts to make it feel like a native £1M app.

1. The "Thumb Zone" Layout

Goal: Pub players hold a pint in one hand and their phone in the other. All buttons must be at the bottom.

How to execute: Provide dartvoice_android.py and use this prompt:

Prompt:
I need to refactor the UI layout of my Android app in dartvoice_android.py to match an ergonomic "Thumb Zone" design.

Rules:

DO NOT touch the GameState, SpeechListener, or billing polling logic.

ONLY modify the DartVoiceLayout._build() method. Replace the current vertical BoxLayout with a FloatLayout.

Specs (Using Kivy):

Top Area (pos_hint={'top': 1}): Center the massive remaining score label (self.score_lbl) near the top so it is never blocked by the user's hand.

Bottom Area (pos_hint={'y': 0}): Create a control deck taking up the bottom 40% of the screen. Draw a Kivy RoundedRectangle on the canvas with only the top corners rounded.

Inside the Deck: Place the "Avg" and "Darts" stats here. Put the massive "START LISTENING" button at the absolute bottom edge so it is perfectly reachable by a thumb.

2. Premium Glass Animations & Haptics

Goal: Add tactile feedback so the user knows the app heard them without looking at the screen.

How to execute: Provide dartvoice_android.py and use this prompt:

Prompt:
I want to make dartvoice_android.py feel like a premium native app by adding animations and haptic feedback.

Tasks:

Import kivy.animation.Animation.

Update the _set_toggle_style() method. When the user taps 'START LISTENING', animate the canvas background color of the button transitioning to the 'Active' state over 0.3 seconds instead of snapping instantly.

Import plyer.vibrator (safely handled for non-Android platforms).

Inside the _on_score callback, trigger a very short haptic vibration (e.g., 50ms) every time a dart is successfully parsed.

3. The "Netflix" Hard-Lock Paywall Overlay

Goal: Create a beautiful, inescapable lock screen when the 10-minute free preview ends.

How to execute: Provide dartvoice_android.py and use this prompt:

Prompt:
I need to update the PaywallOverlay class in dartvoice_android.py to act as a secure, beautiful "Hard Lock" screen.

Tasks:

Ensure PaywallOverlay inherits from FloatLayout. In its canvas, draw a heavy, dark semi-transparent background (Color(0,0,0,0.9)).

It MUST catch all touch events and block interaction with the underlying DartVoiceLayout completely.

Add an entrance animation using kivy.animation.Animation so that when _show_paywall() is called, the overlay slides up smoothly from the bottom of the screen (pos_hint={'y': -1} to pos_hint={'y': 0}) over 0.4 seconds using an out_back transition curve.

Ensure the Stripe "Start Trial" button and the "Checking..." polling logic remain fully functional.

🎨 GLOBAL: Theme Engine Integration

Goal: Allow users to pick ANY hex color and have the entire app generate matching shadows, hover states, and backgrounds dynamically.

How to execute: Provide BOTH dartvoice_v2.py and dartvoice_android.py and use this prompt:

Prompt:
I want to upgrade the Theme Engine in my apps to support custom hex colors seamlessly.

For Windows (dartvoice_v2.py):

In the settings UI, implement a tkinter.colorchooser.

When a user picks a hex color, pass it through my existing _derive_shades() logic to generate the 'glow' and 'dim' variables.

Update THEMES['Custom']['accent'], save it to the config JSON, and call _rebuild_ui().

For Android (dartvoice_android.py):

Add a color picker widget (or hex code text input) to the Settings bottom sheet.

Save the chosen hex to dartvoice_config.json as custom_accent.

Update the _accent_btn rendering logic and canvas drawing instructions so they bind to this new color dynamically, allowing the UI to repaint without needing a full app restart.

🤖 The "HTML-to-Python" Translation Matrix

You have designed pixel-perfect Tailwind HTML mockups in app_ui_prototypes.html. To get an AI (like Claude or ChatGPT) to perfectly translate those HTML designs into actual Python code, you need to teach it the translation mappings.

Use the prompts below to bridge the gap between your HTML mockups and your Python UI libraries.

🪟 Windows (Tailwind HTML to CustomTkinter)

How to use: Copy the HTML block of the Windows prototype you want (e.g., the id="prod-win-main" div) and paste it into the AI chat alongside this exact system prompt:

AI SYSTEM PROMPT:
I am providing you with a Tailwind HTML mockup for my Windows desktop app. I want you to translate this visual layout into customtkinter code for my dartvoice_v2.py file.

The Translation Rules:

Colors: Map my Tailwind colors to my Python variables:

bg-brand-bg -> fg_color=BG

bg-brand-card -> fg_color=CARD

border-brand-wire -> border_color=SEP, border_width=1

bg-brand-red -> fg_color=ACCENT

text-brand-muted -> text_color=FG2

text-white -> text_color=FG

Layout: Translate flex flex-col to pack(side="top", fill="both", expand=True). Translate flex flex-row to pack(side="left") or .grid().

Padding/Margins: Map Tailwind spacing (e.g., p-6, px-4, mb-4) to Tkinter paddings (padx=24, pady=(0, 16)). p-1 roughly equals 4px.

Borders & Radii: Map rounded-xl to corner_radius=12, rounded-full to corner_radius=100.

Typography: Map font-bold text-sm to font=("Rubik", 14, "bold"). Map text-9xl font-black to font=("Uber Move Bold", 120, "bold").

Please generate the _build_content(self) method to perfectly mirror this HTML structure using CTkFrame, CTkLabel, and CTkButton. DO NOT alter any logic outside the UI building method.

📱 Android (Tailwind HTML to Kivy)

How to use: Copy the HTML block of the Android prototype you want (e.g., the id="prod-and-main" div) and paste it into the AI chat alongside this exact system prompt:

AI SYSTEM PROMPT:
I am providing you with a Tailwind HTML mockup for my Android mobile app. I want you to translate this visual layout into kivy code for my dartvoice_android.py file.

The Translation Rules:

Colors: Map my Tailwind colors to my Python/Kivy variables:

bg-brand-bg -> Window.clearcolor = BG

bg-brand-card -> Use my _card_bg(widget, color=CARD) helper function.

bg-brand-red -> Use my _accent_btn helper or Color(*ACCENT) on the canvas.

text-brand-muted -> color=FG2

text-white -> color=FG

Layout: >    * Translate outer positioning (like absolute bottom-0) into a FloatLayout with pos_hint={'y': 0, 'center_x': 0.5}.

Translate flex flex-col into BoxLayout(orientation='vertical').

Translate grid grid-cols-3 into GridLayout(cols=3).

Padding/Margins: Always wrap sizing in Kivy's density-independent pixels (dp()). E.g., Tailwind p-6 translates to padding=dp(24).

Typography: Always wrap font sizes in scalable pixels (sp()). E.g., text-8xl -> font_size=sp(96). text-xs -> font_size=sp(12).

Icons: For UI icons (like the mic or settings cog), use Kivy's Image widget with local .png/.svg assets, or substitute with clear text/emoji if assets are missing.

Please generate the _build(self) method inside DartVoiceLayout to perfectly mirror this HTML structure. Build it entirely in Python code (do not write a .kv string). DO NOT alter the GameState or SpeechListener.

🎨 The Icon Emulation Framework (Drawing SVGs in Python)

You have beautifully designed SVG icons in your app_ui_prototypes.html (like the Microphone, Target, History, and Shield icons). We do not want to use external image files. We want to draw them directly in Python so the apps compile cleanly.

Use this prompt to teach the AI how to translate your raw HTML <svg> tags into Python canvas instructions:

AI SYSTEM PROMPT: DRAWING ICONS
I am passing you an SVG path from my HTML prototypes.
Example SVG: <path d="M12 2a3 3 0 0 0-3 3v7..."></path>

If generating for Windows (dartvoice_v2.py):
Convert the SVG path logic into a helper method that draws on a tkinter.Canvas.
Use canvas.create_line(), canvas.create_oval(), and canvas.create_polygon().
Example: To draw the Microphone, create def _draw_icon_mic(self, canvas, cx, cy, radius, color): and use basic Tkinter primitives to sketch the microphone shape.

If generating for Android (dartvoice_android.py):
Convert the SVG into Kivy graphics instructions. Create a helper method that adds instructions to a widget's canvas.
Example:

with widget.canvas.after:
    Color(*hex_to_kivy(color))
    Line(points=[x1, y1, x2, y2], width=dp(2))
    Ellipse(pos=(x, y), size=(w, h))


🚀 THE "MASTER REFACTOR" AI MEGA-PROMPTS

When you are ready to completely overwrite the UI of your functioning apps to perfectly match specific HTML prototypes, use these hyper-specific Mega-Prompts. They explicitly tell the AI which design to build while fiercely protecting your backend logic.

📱 PRO HUD Mega-Prompt (Android)

How to use: Open a fresh chat. Attach dartvoice_android.py and app_ui_prototypes.html.

AI SYSTEM PROMPT: BUILD THE PRO HUD

Look at the id="android-hud" layout in app_ui_prototypes.html. I want to refactor dartvoice_android.py to match this exact design.

CRITICAL PRESERVATION RULES:
DO NOT alter GameState, SpeechListener, _poll_service(), _billing_gate(), or any logic related to processing voice input or making backend requests.

UI INSTRUCTIONS:

The Circular Score Ring: In the center of the FloatLayout, create a massive widget. Use Kivy Canvas to draw two circles: one dark border-brand-wire ring, and one glowing ACCENT ring drawn as a Line(circle=(cx, cy, r), width=dp(6)).

The Inner Text: Place the self.score_lbl dead center inside the ring. Above it, put a "REMAINING" label. Below it, put the live checkout route label.

The Bottom Glow Bar: The "Tap to Mute" microphone button should be docked to the bottom.

🪟 FOCUS FULLSCREEN Mega-Prompt (Windows)

How to use: Open a fresh chat. Attach dartvoice_v2.py and app_ui_prototypes.html.

AI SYSTEM PROMPT: BUILD THE FOCUS FULLSCREEN

Look at the id="win-focus" layout in app_ui_prototypes.html. I want to refactor the main window of dartvoice_v2.py to match this exact design.

CRITICAL PRESERVATION RULES:
DO NOT touch the _on_score automation logic, the Vosk recognizer thread, or the CHECKOUT tables. Only touch _build_content() and _redraw_score().

UI INSTRUCTIONS:

Remove all sidebars and cards. Make the background purely BG (Oche Black).

Create one massive CTkLabel in the dead center of the screen mapped to self._remaining_str. The font size should be massive (e.g., font=("Uber Move Bold", 250, "bold")).

Place the checkout route CTkLabel directly underneath it, with the last dart colored in ACCENT.

Anchor the "Average", "Darts Thrown", and "Listening" status indicators to the absolute bottom corners of the screen using pack(side='bottom', fill='x') or place().

🪟 UTILITY DOCK Mega-Prompt (Windows)

How to use: Open a fresh chat. Attach dartvoice_v2.py and app_ui_prototypes.html.

AI SYSTEM PROMPT: BUILD THE UTILITY DOCK

Look at the id="win-dock" layout in app_ui_prototypes.html. I want to refactor dartvoice_v2.py to act as a horizontal, top-docked ribbon.

CRITICAL PRESERVATION RULES:
DO NOT touch the pyautogui logic, the _billing_gate, or the SpeechListener.

UI INSTRUCTIONS:

Set the main window geometry to be extremely wide and short, e.g., self.geometry("1024x80").

Use pack(side='left') to arrange everything horizontally.

Layout Order: [Logo] -> [Mic ON/OFF Button] -> [Remaining Score] -> [Checkout Route] -> [Average] -> [Settings Button].

Add a feature to allow the user to drag the window by clicking anywhere on the background frame (bind <ButtonPress-1> and <B1-Motion>).

📱 ANDROID AUTH Mega-Prompt (Login Screen)

How to use: Open a fresh chat. Attach dartvoice_android.py and app_ui_prototypes.html.

AI SYSTEM PROMPT: BUILD THE MOBILE AUTH SCREEN

Look at the id="android-auth" layout in app_ui_prototypes.html. I need to build a Kivy modal/overlay in dartvoice_android.py to handle the OTP login securely.

CRITICAL PRESERVATION RULES:
DO NOT alter the core DartVoiceLayout game screen. We are just building the popup that sits on top of it.

UI INSTRUCTIONS:

Create a new Kivy FloatLayout class called AuthOverlay.

Draw a dark background over the whole screen to block interaction.

Create a clean TextInput for the Email Address, and another for the Magic Code.

Create the "Send Magic Code" button mapped to the existing send_otp() function from billing.py.

Create the "Verify" button mapped to the existing verify_otp() function.

📱 ANDROID SETTINGS Mega-Prompt

How to use: Open a fresh chat. Attach dartvoice_android.py and app_ui_prototypes.html.

AI SYSTEM PROMPT: BUILD THE MOBILE SETTINGS MENU

Look at the id="android-settings" layout in app_ui_prototypes.html. I need to rebuild the settings interface in dartvoice_android.py.

CRITICAL PRESERVATION RULES:
Maintain all self.cfg dictionary saving/loading logic.

UI INSTRUCTIONS:

Create a ScrollView containing a vertical BoxLayout.

Build grouped sections. For example, group "Live Checkouts" and "Per-Dart Mode" inside a rounded Kivy canvas rectangle.

Create custom Kivy Toggle switches for booleans instead of checkboxes (a small rounded rectangle with a sliding circle inside).

Build a grid of circular colored buttons for the Theme Color picker. When clicked, it should instantly overwrite the ACCENT constant and repaint the UI.