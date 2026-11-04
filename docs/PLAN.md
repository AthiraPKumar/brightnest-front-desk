# Front desk agent for a cleaning company — plan (Nov 2026)

## Recommended stack
- **Phone calls:** xAI Grok Voice Agent API (`grok-voice-3.0`, speech-to-speech, ~$0.08/min, ~0.8 s to first audio, 20+ languages incl. German). Connect a Twilio (or Telnyx) Berlin number via SIP. Pin the versioned model name, not `grok-voice-latest`.
- **Quick no-code path for demos:** Grok Voice Agent Builder (~$0.05/min + $0.01/min phone number, one free test number).
- **Messages:** WhatsApp Business API (via Twilio) + website chat widget, using the same Grok model in text mode, same prompt and tools.
- **Tools the agent calls:** quote calculator, availability check, create booking (Google Calendar / Cal.com), escalate to human (SMS/email to owner), log to CRM (Google Sheet/Airtable to start).
- **Backend:** small Node/Python server (e.g. on Railway/Fly) that holds the business config, tools and the single inbox.

## Phases
1. Demo (done): interactive web demo — message + call modes, quotes, bookings, human handoff, editable business info. Live version: https://claude.ai/artifact/JVmga8kPUNuQHtAMgFQhue
2. Real phone demo: Grok Voice Agent Builder or API + Twilio number, one tool (booking), German + English. Lets a prospect call a real number.
3. Pilot with one cleaning company: WhatsApp channel, real calendar, owner alerts, call recordings/transcripts, GDPR notice at call start ("you're speaking with an AI assistant").
4. Productize: per-client config, dashboard, monthly fee per company.

## Notes
- GDPR/EU AI Act: disclose AI at start of call, data processing agreement, transcript retention policy; xAI voice region is US (us-east-1) — check with client.
- Alternatives if needed: ElevenLabs Agents, Vapi or Retell (can also run Grok as the brain), OpenAI realtime.

## Sources
- Grok Voice 3.0 pricing and features: https://www.buildmvpfast.com/blog/grok-voice-3-api-voice-agents-pricing-2026
- Grok Voice Agent Builder pricing: https://www.eesel.ai/blog/grok-voice-agent-builder-pricing
- Grok Voice Agent API setup: https://www.activepieces.com/blog/grok-voice-agent-api-pricing-speed-and-setup-2026.md
