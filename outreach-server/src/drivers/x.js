// X (Twitter) driver — requires paid Basic tier ($200/mo).
// Uses raw fetch against API v2 to avoid pulling in a client SDK.
// Cold DMs to non-followers violate ToS — accounts get locked.

function hasCreds() {
    return !!process.env.X_BEARER_TOKEN;
}

async function lookupUser(handle) {
    const h = handle.replace(/^@/, '');
    const r = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(h)}`, {
        headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` },
    });
    const j = await r.json();
    if (!j.data?.id) throw new Error(j.errors?.[0]?.detail || 'User lookup failed');
    return j.data.id;
}

export const x_dm = {
    async send(row) {
        if (!hasCreds()) return { ok: false, error: 'X_BEARER_TOKEN not set (paid tier required)' };
        const handle = row.prospect?.handle || '';
        if (!handle) return { ok: false, error: 'No X recipient' };
        try {
            const userId = await lookupUser(handle);
            const r = await fetch(`https://api.x.com/2/dm_conversations/with/${userId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: row.body }),
            });
            const j = await r.json();
            if (!j.data?.dm_event_id) return { ok: false, error: j.errors?.[0]?.detail || JSON.stringify(j).slice(0,200) };
            return { ok: true, externalId: j.data.dm_event_id };
        } catch (e) {
            return { ok: false, error: String(e.message || e) };
        }
    },
};

export const x_reply = {
    async send(row) {
        if (!hasCreds()) return { ok: false, error: 'X_BEARER_TOKEN not set' };
        const postUrl = row.prospect?.post_url || '';
        const m = postUrl.match(/status\/(\d+)/);
        if (!m) return { ok: false, error: 'No X tweet id in prospect.post_url' };
        try {
            const r = await fetch('https://api.x.com/2/tweets', {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: row.body, reply: { in_reply_to_tweet_id: m[1] } }),
            });
            const j = await r.json();
            if (!j.data?.id) return { ok: false, error: j.errors?.[0]?.detail || JSON.stringify(j).slice(0,200) };
            return { ok: true, externalId: j.data.id, externalUrl: `https://x.com/i/web/status/${j.data.id}` };
        } catch (e) {
            return { ok: false, error: String(e.message || e) };
        }
    },
};
