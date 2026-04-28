import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { drivers } from './drivers/index.js';

const PORT = Number(process.env.PORT || 3050);
const POLL = Number(process.env.POLL_INTERVAL_MS || 20000);
const ENABLED = String(process.env.BOT_ENABLED).toLowerCase() === 'true';
// Retry loop: transient driver failures (network, rate-limit, 5xx) are
// requeued with exponential backoff up to MAX_ATTEMPTS. Permanent failures
// (driver returns ok:false without transient:true, e.g. validation errors)
// go straight to "failed".
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 5);
const BACKOFF_BASE_MS = Number(process.env.BACKOFF_BASE_MS || 60000);   // 1 min
const BACKOFF_CAP_MS  = Number(process.env.BACKOFF_CAP_MS  || 3600000); // 1 h

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1);
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const lastSentAt = new Map(); // per-platform min-gap throttling

async function claimNext() {
    // Atomic-ish claim: grab oldest pending that's due, mark running.
    const now = new Date().toISOString();
    const { data: rows } = await sb.from('outreach_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', now)
        .order('scheduled_for', { ascending: true })
        .limit(1);
    const row = rows?.[0];
    if (!row) return null;
    const { data: updated } = await sb.from('outreach_queue')
        .update({ status: 'running', attempts: (row.attempts || 0) + 1 })
        .eq('id', row.id).eq('status', 'pending')
        .select().single();
    return updated || null;
}

function gapFor(channel) {
    if (channel.startsWith('reddit')) return Number(process.env.REDDIT_MIN_GAP_MS || 300000);
    if (channel.startsWith('x_'))     return Number(process.env.X_MIN_GAP_MS || 120000);
    return 10000;
}

async function hydrate(row) {
    const out = { ...row };
    if (row.prospect_id) {
        const { data } = await sb.from('social_prospects').select('*').eq('id', row.prospect_id).maybeSingle();
        out.prospect = data || null;
    }
    if (row.creator_id) {
        const { data } = await sb.from('creators').select('*').eq('id', row.creator_id).maybeSingle();
        out.creator = data || null;
    }
    return out;
}

async function markResult(row, result) {
    const attempts = row.attempts || 1;
    // Transient failure under the cap → requeue with exponential backoff + jitter.
    if (!result.ok && result.transient && attempts < MAX_ATTEMPTS) {
        const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * Math.pow(2, attempts - 1));
        const jitter = Math.floor(Math.random() * (exp * 0.25));
        const next = new Date(Date.now() + exp + jitter).toISOString();
        await sb.from('outreach_queue').update({
            status: 'pending',
            scheduled_for: next,
            last_error: result.error || null,
        }).eq('id', row.id);
        await sb.from('outreach_log').insert({
            creator_id: row.creator_id,
            prospect_id: row.prospect_id,
            sent_by: row.created_by,
            channel: row.channel,
            subject: row.subject,
            body: row.body,
            status: 'retry',
            error: `attempt ${attempts}/${MAX_ATTEMPTS}: ${result.error || 'transient'}`,
        });
        console.log(`[${row.channel}] ${row.id} → retry in ${Math.round((exp+jitter)/1000)}s (attempt ${attempts}/${MAX_ATTEMPTS})`);
        return;
    }
    const patch = {
        status: result.ok ? 'done' : 'failed',
        last_error: result.error || null,
    };
    await sb.from('outreach_queue').update(patch).eq('id', row.id);
    await sb.from('outreach_log').insert({
        creator_id: row.creator_id,
        prospect_id: row.prospect_id,
        sent_by: row.created_by,
        channel: row.channel,
        subject: row.subject,
        body: row.body,
        external_id: result.externalId || null,
        external_url: result.externalUrl || null,
        status: result.ok ? 'sent' : 'failed',
        error: result.error || null,
    });
    if (result.ok && row.prospect_id) {
        await sb.from('social_prospects').update({ status: 'contacted', last_contacted: new Date().toISOString() }).eq('id', row.prospect_id);
    }
    if (result.ok && row.creator_id) {
        await sb.from('creators').update({ status: 'contacted', date_contacted: new Date().toISOString().slice(0,10) }).eq('id', row.creator_id);
    }
}

async function tick() {
    if (!ENABLED) return;
    const row = await claimNext();
    if (!row) return;
    const platformKey = row.channel.split('_')[0];
    const gap = gapFor(row.channel);
    const since = Date.now() - (lastSentAt.get(platformKey) || 0);
    if (since < gap) {
        await sb.from('outreach_queue').update({ status: 'pending' }).eq('id', row.id);
        return;
    }
    const driver = drivers[row.channel];
    if (!driver) {
        await markResult(row, { ok: false, error: `No driver for channel "${row.channel}"` });
        return;
    }
    let result;
    try {
        const hydrated = await hydrate(row);
        result = await driver.send(hydrated);
    } catch (e) {
        // Uncaught driver throws are treated as transient — usually network /
        // timeout / 5xx. Permanent driver issues should return ok:false without
        // throwing so they fail-fast without consuming retry budget.
        result = { ok: false, error: String(e.message || e), transient: true };
    }
    lastSentAt.set(platformKey, Date.now());
    await markResult(row, result);
    console.log(`[${row.channel}] ${row.id} → ${result.ok ? 'done' : 'failed: ' + result.error}`);
}

// ── HTTP ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, enabled: ENABLED, drivers: Object.keys(drivers) }));
app.post('/kick', async (_req, res) => { await tick(); res.json({ ok: true }); });

app.listen(PORT, () => {
    console.log(`outreach-server :${PORT}  enabled=${ENABLED}  drivers=${Object.keys(drivers).join(',')}`);
    setInterval(() => { tick().catch(e => console.error('tick', e)); }, POLL);
});
