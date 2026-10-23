# Kynex Code AI Clinic Receptionist

A browser demo of an AI receptionist for a fictional clinic, Sunrise Family Clinic. A visitor can start a live voice conversation, speak English or Hinglish, and hear the receptionist reply. Appointment requests, enquiries, and call summaries are saved for a demo administrator to review.

This is not a telephone product. A connected session is a WebRTC conversation in the browser. The clinic, doctors, address, and hours are demonstration data.

## 1. Prerequisites

- Node.js 20 or newer (Node.js 22 is a comfortable choice)
- npm, which ships with Node.js
- An OpenAI API key with access to the Realtime API
- A Supabase project, for records that survive a restart and a Vercel deploy
- A Chromium, Firefox, or Safari browser on HTTPS or `localhost`, with a microphone

## 2. Node.js version

The app declares `"engines": { "node": ">=20" }`. Check with:

```bash
node -v
```

## 3. Installation

From this directory:

```bash
npm install
```

## 4. Environment configuration

```bash
copy .env.example .env.local
```

On macOS or Linux, use `cp .env.example .env.local`.

Fill in `.env.local`. Every variable below is **server-only**. Do not prefix any of them with `NEXT_PUBLIC_`. The browser never receives the OpenAI key, the Supabase service key, the admin password, or the session secret.

| Variable | Required for | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Live voice | Server key used to open a Realtime session |
| `OPENAI_REALTIME_MODEL` | Optional | Defaults to `gpt-realtime-2.1` |
| `SUPABASE_URL` | Durable storage | Project URL |
| `SUPABASE_ANON_KEY` | Safety check | Public key. This app does not send it to the browser. `SUPABASE_PUBLISHABLE_KEY` is also accepted |
| `SUPABASE_SERVICE_ROLE_KEY` | Durable storage | Service or secret key. `SUPABASE_SECRET_KEY` is also accepted |
| `APP_BASE_URL` | Origin check | For example `http://localhost:3000` |
| `DEMO_ADMIN_PASSWORD` | Reviewing records | Password you type in the Demo admin dialog |
| `SESSION_SECRET` | Admin cookie | A long random string, not the password |

If `OPENAI_API_KEY` is missing, the app still starts and shows **Voice service not configured**. It will not pretend a call connected.

If the Supabase variables are missing, records stay in the server process memory and disappear when that process stops. The dashboard says so.

## 5. Create an OpenAI API key

1. Sign in at [https://platform.openai.com](https://platform.openai.com).
2. Open API keys and create a secret key.
3. Put it in `OPENAI_API_KEY` in `.env.local`.
4. Do not paste the key into source files, chat, or a `NEXT_PUBLIC_` variable.

The key needs access to the Realtime API. Billing must be enabled on the OpenAI project.

## 6. Realtime API configuration

This app uses the documented unified WebRTC interface, checked against the OpenAI Realtime guide:

1. The browser creates a microphone peer connection and an `oai-events` data channel.
2. The browser posts the SDP offer to `POST /api/voice-session` on this app.
3. The server posts that SDP, plus the session instructions and tools, to `https://api.openai.com/v1/realtime/calls` with the server API key.
4. The server returns only the SDP answer, a demo call id, and a demo call token.
5. Audio flows over WebRTC. Tool calls are executed by this app, not by the model writing to the database.

The session uses model `gpt-realtime-2.1` unless `OPENAI_REALTIME_MODEL` is set, voice `marin`, and input transcription model `gpt-4o-mini-transcribe`. The permanent API key never goes to the browser. Do not add the `OpenAI-Beta: realtime=v1` header; this is the GA interface.

## 7. Create a Supabase project

1. Create a project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Open Project Settings → API, or the Connect dialog.
3. Copy the project URL into `SUPABASE_URL`.
4. Copy the publishable or legacy anon key into `SUPABASE_ANON_KEY`.
5. Copy the secret or legacy service-role key into `SUPABASE_SERVICE_ROLE_KEY`.

Supabase is replacing the older anon and service-role keys with publishable and secret keys. This app accepts either pair. The service key bypasses Row Level Security and must stay on the server. If it is identical to the public key, the app refuses to use it.

## 8. Apply the database migration

In the Supabase SQL Editor, paste and run:

`supabase/migrations/20261022143000_init_receptionist.sql`

Or, with the Supabase CLI linked to the project:

```bash
supabase db push
```

The migration creates `demo_calls`, `appointment_requests`, `demo_enquiries`, `clinic_settings`, and `tool_invocations`, and seeds the fictional clinic.

## 9. Row Level Security

The migration enables RLS on every table and revokes all privileges from `anon` and `authenticated`. It creates no policies. Anonymous clients cannot read calls, transcripts, phone numbers, or appointment requests through the Data API. The Next.js server uses the service key after its own authorization checks.

Do not add a policy such as `using (true)`.

## 10. Run the app locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 11. Microphone permission

1. Use `localhost` or HTTPS. Browsers block the microphone on insecure public origins.
2. Tick the consent box. Start Demo stays disabled until you do.
3. Choose Start Demo. The browser asks for the microphone only then.
4. If you deny it, the page says so and does not start a fake call.
5. Use Mute microphone during a session. End conversation releases the microphone tracks.

## 12. Test a real conversation

1. Confirm the voice banner is gone. If it says the voice service is not configured, check `OPENAI_API_KEY` and restart `npm run dev`.
2. Tick consent. Optionally tick transcript storage.
3. Choose Start Demo and allow the microphone.
4. Wait until the status moves past Connecting. The receptionist should greet you.
5. Try “What time does the clinic close?” or “Clinic kitne baje band hota hai?”
6. You can also send a typed line through the same live session if the room is noisy. That still uses the Realtime session. It is not a separate chatbot, and it does nothing when the voice service is down.
7. Choose End conversation. A summary appears. Audio is not saved.

## 13. Test an appointment request

Say that you would like an appointment tomorrow, then answer the receptionist’s questions for doctor or service, time, name, and phone. Confirm the details when asked.

The saved record has status **New**. It is a request, not a booking. Sign in with Demo admin, open Appointments, and only then can you mark it Pending confirmation, Confirmed, or Cancelled. Confirmed means a person clicked that button in this demo. No SMS, WhatsApp, or email is sent.

Past dates are rejected. The receptionist is not given a list of open slots, because no calendar is connected.

## 14. Troubleshoot API errors

- **Voice service not configured.** `OPENAI_API_KEY` is empty. Restart the dev server after changing `.env.local`.
- **The voice service could not start a session.** The key is present but OpenAI rejected the session. Check billing, Realtime model access, and that `OPENAI_REALTIME_MODEL` is a current Realtime model. The server logs the HTTP status only, not the key.
- **Microphone access was denied.** Allow the microphone for localhost in the browser site settings and start again.
- **The database is not ready.** Run the migration. Until then, leave the Supabase variables empty to use temporary memory, or fix the tables.
- **Demo admin access is not configured.** Set both `DEMO_ADMIN_PASSWORD` and `SESSION_SECRET`.
- **Too many demo sessions.** The voice endpoint allows 8 starts per 10 minutes per IP. Wait and try again.
- **Sign-in was not accepted.** The password does not match `DEMO_ADMIN_PASSWORD`.

## 15. Deploy to Vercel

1. Push the project to a Git host Vercel can read.
2. Import the repository in Vercel. Framework preset: Next.js. Root directory: this folder.
3. Add the environment variables from section 4. Use the production URL for `APP_BASE_URL`, for example `https://your-app.vercel.app`, with no trailing slash.
4. Deploy.
5. Open the deployment over HTTPS and allow the microphone.

`npm run build` is the production build Vercel runs.

In-memory records are not shared across serverless instances. Configure Supabase before a client meeting on Vercel.

## 16. Production environment variables

Set the same server-only variables as in section 4 in the Vercel project settings. Do not mark the OpenAI key, service key, admin password, or session secret as exposed to the browser.

`APP_BASE_URL` must be the public origin. Microphone access also requires the Permissions-Policy header already set by `next.config.ts` (`microphone=(self)`).

## 17. Security checklist before a demo

- `.env.local` is not committed. `.gitignore` ignores `.env*`.
- The page shows that the clinic is fictional and that this is a browser demo.
- Start Demo does nothing useful until consent is ticked.
- Call history and phone numbers require the demo admin cookie.
- Appointment status, clinic edits, sample records, and reset require that cookie.
- Reset asks for confirmation and only deletes demo operations data, not the clinic settings row.
- The OpenAI key is used only in the server route that exchanges SDP.
- RLS is enabled and there is no public read policy.
- You are not showing a real patient’s information. Use the fictional clinic or clearly labelled sample records.
- Sample records are badged and are excluded from the activity counts.

## 18. Before real telephone calling

This build does not place or receive phone calls. Before that exists, you would need a telephony provider, a supported OpenAI SIP or realtime calling setup, call recording rules, consent at the start of the phone call, and a review of Indian privacy and telecom requirements. Do not tell a clinic that this demo already answers their phone line.

## Scripts

```bash
npm run dev
npm run test
npm run lint
npm run typecheck
npm run build
npm start
```

## What was tested here

Unit tests cover appointment validation, past dates, duplicate tool calls, unknown tools, admin cookies, session cleanup, empty states, a missing OpenAI key, and the migration’s RLS revoke. They were run without a live OpenAI key and without a Supabase project.

A live spoken conversation, a real Supabase insert, and the production Vercel deploy still need your own credentials. Those paths are implemented, and they fail honestly when the credentials are absent.

## Privacy

Read `/privacy` in the app. The demo is not a certification of compliance with Indian law. Audio is not stored. Transcripts are stored only when the visitor opts in. Review consent language, retention, and provider terms before any real clinic uses it.
