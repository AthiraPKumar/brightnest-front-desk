# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A sales demo of an AI receptionist ("front desk") for a cleaning company: it quotes from a price list, books jobs, and hands complaints to the owner, over a simulated phone call or WhatsApp chat. There is no build, lint, or test tooling. The demo is one self-contained HTML page (inline CSS + JS, Google Fonts only), plus three Vercel serverless functions: `api/chat.js` gives the hosted site live Grok replies, `api/voice-token.js` enables browser microphone calls through Grok Voice, and `api/booking.js` lets those calls book on Cal.com. `docs/PLAN.md` holds the roadmap for the real product (Grok Voice Agent + Twilio + WhatsApp). The real phone line and WhatsApp are not implemented yet.

## The two copies of the page

- `index.html` (repo root) is the hosted static website. The repo root is the publish directory for GitHub Pages, Netlify, Vercel and similar hosts. There is no build step, and `.nojekyll` turns off Jekyll on GitHub Pages. Keep the page self-contained: hosts serve the root as-is, so it should not depend on any other file in the repo. The only exceptions are the optional `/api/chat`, `/api/voice-token` and `/api/booking` calls, which the page survives without.
- `artifact/artifact-source.html` is the same content without the doctype/head/body wrapper (the 8 header lines and the closing `</body></html>`). It is published as a Claude Artifact at https://claude.ai/artifact/JVmga8kPUNuQHtAMgFQhue, and the Artifact host adds the wrapper at publish time.

Apply every change to both files. Apart from the wrapper, they should diff clean. After changing the artifact copy, republish it to the existing URL using the Artifact tool's `url`. Live AI comes from Claude inside the Artifact and from Grok via `/api/chat` on Vercel. Anywhere else, the page falls back to the scripted **Play sample** demo.

## The Grok function (`api/chat.js`)

- Vercel Node function in CommonJS (`module.exports`). There is no `package.json` and there are no dependencies, and it uses the global `fetch`.
- Takes `POST {system, messages}`, where `system` is `rules()` and `messages` are user/assistant turns. It calls `https://api.x.ai/v1/chat/completions` with `response_format: {type:'json_object'}` and returns the normalised `{reply, status, booking, handoff}`. Errors come back as `{error:{code, message}}` with a 4xx or 5xx status.
- A fixed server-side `GUARD` prompt goes before the page's prompt. It keeps the assistant on topic and professional, and makes it say honestly that it is an AI whenever asked. The browser cannot override it.
- Environment: `xAI_API_New` (required, case-sensitive, set in Vercel, never in the page or git; `XAI_API_KEY` is read as a fallback, see `apiKey()`) and `XAI_MODEL` (optional, default `grok-4.20-0309-non-reasoning`). `.env.example` lists both with no values. `.gitignore` ignores `.env*` except `.env.example`.
- Limits live in `LIMITS`: 30 messages, 1,200 characters per message, 12,000-character system prompt, 15 requests per minute and 300 per day per IP (in memory, per instance, best-effort), and a 25 s upstream timeout. The page's textarea has `maxlength="1200"` to match.

## The voice token function (`api/voice-token.js`)

- Same style as `api/chat.js`. `POST` from the site's own origin returns `{token, model, voice, guard}`, using `https://api.x.ai/v1/realtime/client_secrets`. The token lasts 300 s, and the real key never reaches the browser.
- Environment: the same key as `api/chat.js`, plus `XAI_VOICE_MODEL` (optional, default `grok-voice-3.0`) and `XAI_VOICE` (optional, default `ara`; xAI's docs describe Eve and Leo as British).
- Limits live in `LIMITS`: 3 calls per minute and 20 per day per IP (in memory, per instance, best-effort).
- The browser sends `session.update` itself, because xAI's token endpoint doesn't accept session settings. So here `GUARD` is sent to the page and can't be enforced, unlike in `api/chat.js`.

## The booking function (`api/booking.js`)

- Same style as `api/chat.js`. `POST {action:'slots', date, duration_minutes}` returns free times from Cal.com, and `POST {action:'book', start, duration_minutes, name, email, ...}` creates the booking. Mia takes the job length from `JOB LENGTH` in the KB. The function reads the booking type's public settings, picks the shortest allowed length that fits, and sends the caller's address when the location is In Person (Attendee Address). Errors come back as `{error:{code, message}}`, and `slot_taken` means Mia should offer another time.
- Environment: `CAL_API_KEY` (set in Vercel, never in the page or git) is the switch for this feature. `/api/voice-token` returns `booking: true` when it is set, and the function refuses requests without it. `CAL_USERNAME` and `CAL_EVENT_SLUG` are optional and choose the booking type.
- Limits live in `LIMITS`: 3 bookings per hour and 5 per day per IP, 30 per day per instance, and 20 availability checks per minute per IP (in memory, best-effort).

## How the page works (script at the bottom of the file)

- **Business knowledge base:** `DEFAULT_KB` is a plain-text block with prices, area, availability and policies for a sample Berlin business. The **Business setup** section lets a user edit the company name, assistant name (default "Mia") and KB. These edits are saved to `localStorage` (`fd.kb`, `fd.co`, `fd.agent`) through a try/catch `store` wrapper. The agent may only quote facts that appear in the KB.
- **Prompt:** `rules()` builds the system prompt from the KB, the current channel (`mode` is `'call'` or `'message'`, and each mode has its own style rules), and today's date. It requires the model to answer with a strict JSON object: `{reply, status, booking, handoff}`. `rules(true)` builds the Grok Voice version, which replaces the JSON format with the `save_booking` and `save_handoff` tools. `rules(true, true)` adds real booking through the `check_availability` and `book_appointment` tools (see `voiceCalendar()`), and Mia may only say an appointment is booked after `book_appointment` succeeds. Typed chats still only capture requests.
- **Live AI:** `ensureAI()` picks a `backend`, and `askAI()` sends the prompt plus the last 24 turns to it.
  - `'claude'`: used when `window.claude` exists. It goes through the Artifact runtime's sampling capability, where `window.claude.use('sample')` returns a handle and `sample.json([...], {modelTier:'quick'})` is called.
  - `'api'`: used when `window.claude` does not exist. It calls `POST /api/chat`.
  - Hard failures (`not_granted`, `sampling_disabled`, `api_unreachable`, `not_configured`) call `aiOff()`, which shows `#noAI`. After that, only **Play sample** works.
- **AI disclosure:** every conversation starts with the on-screen `DISCLOSE` system line, which says the customer is talking to an AI assistant for a sample business. Mia doesn't say this aloud, but she must never claim to be human and must say she is an AI if asked. It appears in message mode in `resetConvo()` and in call mode in `callAnswered()`. Keep it.
- **Scripted fallback:** the `SCRIPT` array drives **Play sample**, which plays a canned conversation without AI.
- **Owner's ledger:** when a response includes `booking` or `handoff`, `addRow()` adds a row and `renderStats()` updates the totals (requested value, requests, handoffs).
- **Call mode:** the call rings first (`startRing()`, at least two rings, German 425 Hz tone made with Web Audio, no audio file), then `callAnswered()` shows the disclosure and Mia greets the caller. `startVoice()` opens a Grok Voice session (`wss://api.x.ai/v1/realtime`) with a token from `/api/voice-token`, streams the microphone as PCM, plays the replies and shows transcripts. Mia hangs up with the `end_call` tool after a goodbye or a confirmed booking, once her audio has finished (see `voiceFinish()`). Calls end after 5 minutes. It is skipped when `window.claude` exists. If it can't start, the call falls back to typing, with replies spoken by the browser's `speechSynthesis` (see `speak()` and `pickVoice()`).

## Design conventions

The visual theme is called "Alpine", and the comment at the top of the `<style>` block describes it. Colours are CSS custom properties on `:root`. Dark mode redefines them in two places: under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. A palette change must be made in all three blocks. Fonts are Instrument Serif (headings), Geist (body text) and Geist Mono (labels). A matching design file, "AI Front Desk — Cleaning Co.", exists in Paper.
