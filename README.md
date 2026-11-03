# BrightNest — AI Front Desk for a cleaning company

An AI receptionist that answers customer calls and WhatsApp messages for a cleaning company:
it quotes from the price list, books jobs, and hands complaints to the owner.

## What's in this repo
- `index.html` — the demo page (the hosted website). Double-click to open it locally.
  Outside Claude, use **Play sample** to run the scripted conversation.
  Live AI replies only work in the published version on Claude:
  https://claude.ai/artifact/JVmga8kPUNuQHtAMgFQhue
- `artifact/artifact-source.html` — the exact source published to Claude (same page without the HTML wrapper).
- `docs/PLAN.md` — recommended stack (Grok Voice Agent + Twilio + WhatsApp), phases and notes.
- Design file: "AI Front Desk — Cleaning Co." in Paper.

## Hosting
It's a single static page with no build step. Deploy the repo root as-is:
- **GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / `(root)`. (`.nojekyll` is included.)
- **Netlify / Vercel / Cloudflare Pages:** import the repo, no build command, publish directory `/` (root).

## Editing the demo for a prospect
Open the page → scroll to **Business setup** → change company name, assistant name and the
price list. The agent only quotes what is written there. Changes are saved in your browser.

## Next step
Phase 2: a real phone number (Grok Voice Agent + Twilio) that prospects can call during a demo.
