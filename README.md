# BrightNest — Front Desk Agent for a cleaning company

An AI receptionist that answers customer calls and WhatsApp messages for a cleaning company:
it quotes from the price list, books jobs, and hands complaints to the owner.
BrightNest is a sample business. Every chat shows an on-screen note that the customer is talking to an AI assistant, and Mia says so if asked.

Live demo: https://brightnest-front-desk.vercel.app/

## What's in this repo
- `index.html` — the demo page (the hosted website).
- `api/chat.js` — Vercel serverless function that gives the hosted site live replies from xAI Grok.
- `api/voice-token.js` — Vercel serverless function that gives the page a short-lived token for microphone calls through Grok Voice.
- `api/booking.js` — Vercel serverless function that checks free times and creates bookings on Cal.com during voice calls.
- `artifact/artifact-source.html` — the exact source published to Claude (same page without the HTML wrapper):
  https://claude.ai/artifact/JVmga8kPUNuQHtAMgFQhue
- `.env.example` — the environment variables the function reads.
- `docs/PLAN.md` — recommended stack (Grok Voice Agent + Twilio + WhatsApp), phases and notes.
- Design file: "AI Front Desk — Cleaning Co." in Paper.

## Where live AI comes from
| Where the page runs | Live replies | If unavailable |
|---|---|---|
| Claude Artifact | Claude, via `window.claude` | **Play sample** |
| Vercel | Grok, via `POST /api/chat` | **Play sample** |
| Opened as a file / plain static host | none | **Play sample** |

## Hosting on Vercel (with live Grok replies)
1. Import the repo on Vercel. Framework preset **Other**, no build command, root directory `/`.
   Vercel serves `index.html` and deploys `api/chat.js` as a function automatically.
2. In **Settings → Environment Variables**, add `xAI_API_New` (your key from console.x.ai; the name is case-sensitive). The older name `XAI_API_KEY` still works as a fallback.
   Optional: `XAI_MODEL` to change the model (default `grok-4.20-0309-non-reasoning`).
3. Redeploy. Every push to `main` redeploys.

The key is only read on the server. It is never sent to the browser, and it must never be committed:
`.env` files are git-ignored, and only `.env.example` (no values) is tracked.

`api/chat.js` limits: POST only, at most 30 messages of 1,200 characters each, a 12,000-character
business setup, and about 15 requests per minute / 300 per day per IP. The rate limit is held in
memory per function instance, so it is best-effort. Add a shared store such as Vercel KV for a hard limit.

GitHub Pages, Netlify and Cloudflare Pages also serve the page as-is, but without the function,
so they only offer **Play sample**.

## Microphone calls (Grok Voice)
On Vercel, **Phone call** talks to Grok Voice through the browser's microphone. It uses the same
`xAI_API_New` key. The key needs permission for voice, and the xAI team needs credits.
Grok Voice costs about $0.08 per minute. Check current prices on xAI's site.
Optional: `XAI_VOICE_MODEL` (default `grok-voice-3.0`) and `XAI_VOICE` (default `ara`).

If voice can't start, or the page runs anywhere else, the call falls back to typing, with replies
spoken by the browser. Inside the Claude Artifact, calls always use typing.

Cost and safety limits: 3 calls per minute and 20 per day per IP (best-effort), and a 5-minute limit
per call that the page enforces. The browser sets up the voice session, so someone technical could
change Mia's instructions or keep a call open longer. **Set a spending limit in the xAI console.**

## Calendar bookings (Cal.com)
Add `CAL_API_KEY` in Vercel to let Mia check free times and book appointments during a microphone call.
The appointment goes on the Cal.com booking type set by `CAL_USERNAME` and `CAL_EVENT_SLUG`, and Cal.com emails the caller.
Without the key, Mia takes a request and says the team will confirm. Typed chats and calls that fall back to typing always work that way.

Mia takes the job length from `JOB LENGTH` in the business setup. Turn on multiple durations in Cal.com and add those lengths, or every booking uses the default length.
Working hours, location and calendar sync are set in Cal.com.
Limits: 3 bookings per hour and 5 per day per IP, and 30 per day overall (in memory, per instance, best-effort).
Because the page is public, anyone can book and enter any email address. Set a daily booking limit on the booking type in Cal.com too.

## Editing the demo for a prospect
Open the page → scroll to **Business setup** → change company name, assistant name and the
price list. The agent only quotes what is written there. Changes are saved in your browser.

## Next step
Phase 2: a real phone number (Grok Voice Agent + Twilio) that prospects can call during a demo.
The browser microphone call doesn't use a phone number.
