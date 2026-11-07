// Supabase Edge Function: send-push
// Notifies the *other* partner when something happens on this phone
// (login, daily cover photo, playtime message).
//
// Deploy (one time, from the repo root):
//   supabase functions deploy send-push
//
// It needs the project's SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (Supabase provides these as secrets automatically).

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COPY: Record<string, { title: string; body: string }> = {
  login: { title: 'Your baby just logged in 💞', body: 'Come say hi — they missed you 🌿' },
  cover: { title: 'New Daily Cover Photo 📸', body: 'Your partner just posted today\'s cover — go look 🔥' },
  playtime: { title: 'Playtime message 🥵', body: 'Someone is thinking dirty thoughts about you 💋' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { couple_id, from_user, kind } = await req.json();
    const copy = COPY[kind];
    if (!couple_id || !copy || (from_user !== 'daddy' && from_user !== 'princess')) {
      return new Response(JSON.stringify({ error: 'bad request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const partner = from_user === 'daddy' ? 'princess' : 'daddy';
    const { data } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('couple_id', couple_id)
      .eq('user_key', partner)
      .maybeSingle();

    const token = data?.expo_push_token;
    if (!token) {
      return new Response(JSON.stringify({ ok: false, reason: 'no partner token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        priority: 'high',
        badge: 1,
        title: copy.title,
        body: copy.body,
        data: { kind, from_user },
      }),
    });
    const result = await res.json();

    return new Response(JSON.stringify({ ok: true, expo: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
