import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return new Response('Only POST', { status: 405 });

    const body = await req.json();
    const phone = body.phone;
    const userId = body.user_id;
    const action = body.action || 'send'; // 'send' or 'verify'

    if (!phone || !userId) return new Response(JSON.stringify({ error: 'missing phone or user_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const code = (Math.floor(100000 + Math.random() * 900000)).toString();

    const TW_SID = Deno.env.get('TWILIO_SID');
    const TW_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TW_FROM = Deno.env.get('TWILIO_FROM');

    if (action === 'send') {
      if (TW_SID && TW_TOKEN && TW_FROM) {
        const bodyParams = new URLSearchParams();
        bodyParams.append('To', phone);
        bodyParams.append('From', TW_FROM);
        bodyParams.append('Body', `DartVoice verification code: ${code}`);
        const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
          method: 'POST',
          body: bodyParams,
          headers: { 'Authorization': 'Basic ' + btoa(`${TW_SID}:${TW_TOKEN}`) }
        });
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: 'twilio_failed' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }
      }

      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE');
      if (SUPABASE_URL && SUPABASE_KEY) {
        await fetch(`${SUPABASE_URL}/rest/v1/dartvoice_profile_verifications`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, phone, code, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), verified: false })
        });
      }

      return new Response(JSON.stringify({ ok: true, sent: !!(TW_SID && TW_TOKEN && TW_FROM), code: (TW_SID ? undefined : code) }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'verify') {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE');
      if (!(SUPABASE_URL && SUPABASE_KEY)) return new Response(JSON.stringify({ error: 'no_db' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

      const provided = body.code;
      const q = `${SUPABASE_URL}/rest/v1/dartvoice_profile_verifications?user_id=eq.${userId}&phone=eq.${encodeURIComponent(phone)}&order=created_at.desc&limit=1`;
      const resp = await fetch(q, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } });
      const rows = await resp.json();
      const v = rows && rows[0];
      if (!v) return new Response(JSON.stringify({ ok: false, reason: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      if (v.verified) return new Response(JSON.stringify({ ok: true, already: true }), { headers: { 'Content-Type': 'application/json' } });
      if (new Date(v.expires_at) < new Date()) return new Response(JSON.stringify({ ok: false, reason: 'expired' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (v.code !== provided) return new Response(JSON.stringify({ ok: false, reason: 'wrong_code' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      await fetch(`${SUPABASE_URL}/rest/v1/dartvoice_profile_verifications?id=eq.${v.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: true })
      });

      await fetch(`${SUPABASE_URL}/rest/v1/dartvoice_profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_verified: true })
      });

      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown_action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
