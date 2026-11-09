// Supabase Edge Function: send-push (APNs direct — no Expo required)
// Notifies your lover via native APNs device tokens.
//
// Deploy (one time, from the repo root):
//   supabase functions deploy send-push
//
// Secrets needed (set once):
//   supabase secrets set APNS_KEY_ID=<10-char key id> APNS_TEAM_ID=<team id> APNS_APP_ID=com.spector.ILYAlways
//   supabase secrets set APNS_KEY="$(cat apns-key.p8)"  (the .p8 file contents)

import { createClient } from 'npm:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COPY: Record<string, (from: string) => { title: string; body: string }> = {
  login: (from) =>
    from === 'daddy'
      ? { title: 'Your lover just logged in 💞', body: 'Come say hi — he missed you 🌿' }
      : { title: 'Your lover just logged in 💞', body: 'Come say hi — she missed you 🌿' },
  cover: () => ({ title: 'New Daily Cover Photo 📸', body: 'Your lover just posted today\'s cover — go look 🔥' }),
  playtime: () => ({ title: 'Playtime message 🥵', body: 'Someone is thinking dirty thoughts about you 💋' }),
  dose: () => ({ title: 'Dose taken 💊', body: 'Your lover just tapped "Take now" — nice work, gorgeous 🌿' }),
  joint: (from) =>
    from === 'daddy'
      ? { title: 'Your lover passed you a joint 🔥', body: 'He lit it for you — take a hit, gorgeous 🌿' }
      : { title: 'Your lover passed you a joint 🔥', body: 'She lit it for you — take a hit, gorgeous 🌿' },
};

// APNs provider auth is JWT with ES256 signed by the .p8 key.
// Deno supports WebCrypto EC256 via importKey('pkcs8').
async function makeApnsJwt(keyId: string, teamId: string, keyPem: string): Promise<string> {
  const header = { alg: 'ES256', kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: teamId, iat: now };
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const signingInput = `${b64(header)}.${b64(payload)}`;

  const pemBody = keyPem.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replaceAll(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${signingInput}.${sigB64}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { couple_id, from_user, kind } = await req.json();
    const makeCopy = COPY[kind];
    if (!couple_id || !makeCopy || (from_user !== 'daddy' && from_user !== 'princess')) {
      return new Response(JSON.stringify({ error: 'bad request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const copy = makeCopy(from_user);

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

    const deviceToken = data?.expo_push_token;
    if (!deviceToken) {
      return new Response(JSON.stringify({ ok: false, reason: 'no partner token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyId = Deno.env.get('APNS_KEY_ID') ?? '';
    const teamId = Deno.env.get('APNS_TEAM_ID') ?? '';
    const keyPem = Deno.env.get('APNS_KEY') ?? '';
    const bundleId = Deno.env.get('APNS_APP_ID') ?? 'com.spector.ILYAlways';
    if (!keyId || !teamId || !keyPem || !keyPem.includes('BEGIN PRIVATE KEY')) {
      return new Response(JSON.stringify({ ok: false, reason: 'apns secrets missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = await makeApnsJwt(keyId, teamId, keyPem);

    const apnsRes = await fetch(`https://api.push.apple.com/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      body: JSON.stringify({
        aps: {
          alert: { title: copy.title, body: copy.body },
          sound: 'default',
          badge: 1,
        },
        kind,
        from_user,
      }),
    });
    const apnsText = await apnsRes.text();

    return new Response(JSON.stringify({ ok: apnsRes.ok, apns: apnsText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
