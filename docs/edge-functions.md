# Edge Functions

Two functions live in `supabase/functions/`. Deploy both once (needs the
Supabase CLI — `npm i -g supabase`, `supabase login`, `supabase link --project-ref <ref>`):

```bash
supabase functions deploy ai-image-edit
supabase functions deploy send-push
```

## `ai-image-edit` (Dirty Darkroom 🔥)

Calls OpenAI's image edit API. It needs your OpenAI key as a secret:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

### About "censored" / uncensored models

Fooocus-style (Stable Diffusion, no cloud filter) **cannot run inside the
iPhone app** — it needs a beefy GPU (an RTX card is typical) and ~8GB+ VRAM.
Cloud APIs (OpenAI, Replicate, Stability, etc.) all apply their own content
filters, so no hosted option is truly "uncensored."

If you have a PC with an NVIDIA GPU, you *can* run Fooocus (or ComfyUI /
Fooocus) at home and have the phone app talk to it over your home Wi-Fi.
That's a bigger project (local server, port forwarding, API adapter), but it
is doable — the app already speaks HTTP to Supabase, so a local endpoint
would slot in the same way. Until then, the OpenAI backend is what keeps
Dirty Darkroom working.

## `send-push` (partner notifications)

Notifies your partner when you log in, add a daily cover photo, or post in
Playtime. Needs only the project's `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, which Supabase provides to functions
automatically. Also needs the `push_tokens` table from the SQL doc.
