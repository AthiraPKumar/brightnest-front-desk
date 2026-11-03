# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A sales demo of an AI receptionist ("front desk") for a cleaning company: it quotes from a price list, books jobs, and hands complaints to the owner, over a simulated phone call or WhatsApp chat. There is no build, lint, or test tooling. The whole demo is one self-contained HTML page (inline CSS + JS, Google Fonts only). `docs/PLAN.md` holds the roadmap for the real product (Grok Voice Agent + Twilio + WhatsApp). None of that is implemented in this repo yet.

## The two copies of the page

- `index.html` (repo root) is the hosted static website. The repo root is the publish directory for GitHub Pages, Netlify, Vercel and similar hosts. There is no build step, and `.nojekyll` turns off Jekyll on GitHub Pages. Keep the page self-contained: hosts serve the root as-is, so it should not depend on any other file in the repo.
- `artifact/artifact-source.html` is the same content without the doctype/head/body wrapper (the 8 header lines and the closing `</body></html>`). It is published as a Claude Artifact at https://claude.ai/artifact/JVmga8kPUNuQHtAMgFQhue, and the Artifact host adds the wrapper at publish time.

Apply every change to both files. Apart from the wrapper, they should diff clean. After changing the artifact copy, republish it to the existing URL using the Artifact tool's `url`. Live AI only works inside the Claude Artifact. The hosted site falls back to the scripted **Play sample** demo.

## How the page works (script at the bottom of the file)

- **Business knowledge base:** `DEFAULT_KB` is a plain-text block with prices, area, availability and policies for a sample Berlin business. The **Business setup** section lets a user edit the company name, assistant name (default "Mia") and KB. These edits are saved to `localStorage` (`fd.kb`, `fd.co`, `fd.agent`) through a try/catch `store` wrapper. The agent may only quote facts that appear in the KB.
- **Prompt:** `rules()` builds the system prompt from the KB, the current channel (`mode` is `'call'` or `'message'`, and each mode has its own style rules), and today's date. It requires the model to answer with a strict JSON object: `{reply, status, booking, handoff}`.
- **Live AI:** this goes through the Artifact runtime's sampling capability. `window.claude.use('sample')` returns a handle, and `sample.json([...], {modelTier:'quick'})` is called with the prompt plus the last 24 turns. This only works inside the published artifact. Opened locally, `#noAI` is shown and only **Play sample** works.
- **Scripted fallback:** the `SCRIPT` array drives **Play sample**, which plays a canned conversation without AI.
- **Owner's ledger:** when a response includes `booking` or `handoff`, `addRow()` adds a row and `renderStats()` updates the totals (booked value, bookings, handoffs).
- **Call mode:** replies are spoken with the browser's `speechSynthesis` (see `speak()` and `pickVoice()`).

## Design conventions

The visual theme is called "Alpine", and the comment at the top of the `<style>` block describes it. Colours are CSS custom properties on `:root`. Dark mode redefines them in two places: under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. A palette change must be made in all three blocks. Fonts are Instrument Serif (headings), Geist (body text) and Geist Mono (labels). A matching design file, "AI Front Desk — Cleaning Co.", exists in Paper.
