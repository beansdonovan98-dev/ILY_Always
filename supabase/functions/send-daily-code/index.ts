import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') || '';

serve(async (req) => {
  try {
    const { to, code } = await req.json();
    if (!to || !code) return new Response('Missing to/code', { status: 400 });

    const body = new URLSearchParams({
      To: to,
      From: TWILIO_FROM,
      Body: `Your daily room code is: ${code}. It expires at midnight.`,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(text, { status: res.status });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});