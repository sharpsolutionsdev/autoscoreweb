# Team Collaboration & Development Workflow

As the DartVoice project grows from a solo-founder prototype to a collaborative engineering effort, standardizing how you develop, use AI, and work alongside new programmers is critical to prevent code conflicts and maintain momentum.

## 1. Best Ways to Continue Development (Tools & AI)
This project was conceptualized alongside advanced AI. To maintain that speed, you should leverage modern AI-assisted engineering tools:

- **AI-Native IDEs:** Tools like **Cursor**, **Gemini Code Assist**, or **GitHub Copilot** are essential. They allow you to point an AI at your entire workspace so it understands the relationship between your `dartvoice_v2.py` and your `.json` configs simultaneously.
- **The Core AI Workflow:** Never ask an AI to "build a feature" blindly. Always provide the AI with your static HTML prototype (e.g., `html/web-app.html`) and explicitly tell it to translate the UI into Python/JavaScript using the rules laid out in `05_UI_ENGINEERING_GUIDE.md`.
- **Modular Prompts:** Continue building single, isolated features at a time. If you want to add a feature, prototype the visual design in Frontend HTML first, then have the AI translate it.

## 2. Setting Up Collaborative Environments
When a new programmer joins the team, they need to be able to pull down the code and run it immediately without breaking your setup.

- **Version Control (GitHub):** 
  - Never push code directly to the `main` branch. 
  - The new programmer should create "Feature Branches" (e.g., `git checkout -b feature/stripe-webhooks`). 
  - You (as the founder) review via "Pull Requests" (PRs) before merging it into the live codebase.
- **Python Virtual Environments:** Python dependencies can get messy. Both of you must use a virtual environment (`venv`). Require the new programmer to run `pip install -r requirements.txt` to ensure they have the exact same versions of `customtkinter`, `vosk`, and `kivy`.
- **Environment Variables:** Never commit Stripe Live Keys or API credentials. Use a `.env` file that is ignored by Git, and share API keys securely via a password manager.

## 3. Splitting Roles (How to Co-Work)
If you are collaborating with a systems programmer, you must draw a strict line splitting your domains of responsibility so you aren't overwriting each other's code.

### Role 1: Founder & Front-End Architect (You)
- **UI/UX Prototypes:** You own the visual flow. You design new pages, dashboards, and app layouts using Tailwind/HTML.
- **AI Prompting:** You use AI to translate your HTML mockups into the frontend GUIs (CustomTkinter/Kivy).
- **Product Vision:** You define the features, write the marketing copy, and structure the pricing funnel.

### Role 2: Backend & Systems Engineer (The Programmer)
- **Data Architecture:** They handle the database (Supabase), user tables, and secure OTP generation.
- **Stripe & Webhooks:** They write the server logic that confirms payments and updates a user's subscription status.
- **Core Algorithms:** They refine complex systems like the PyAutoGUI coordinate math, the Vosk threaded listeners, or potential anti-cheat algorithms. 

By splitting these roles, you can continuously push HTML updates to the website and tweak the colors of the Desktop App, while the Programmer works strictly on the backend APIs and data flow under the hood.

