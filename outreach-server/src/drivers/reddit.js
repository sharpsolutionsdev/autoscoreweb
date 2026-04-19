import snoowrap from 'snoowrap';

let _r = null;
function client() {
    if (_r) return _r;
    const { REDDIT_USER_AGENT, REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD } = process.env;
    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
        throw new Error('Reddit creds missing — fill REDDIT_* in .env');
    }
    _r = new snoowrap({
        userAgent: REDDIT_USER_AGENT || 'dartvoice-outreach/0.1',
        clientId: REDDIT_CLIENT_ID,
        clientSecret: REDDIT_CLIENT_SECRET,
        username: REDDIT_USERNAME,
        password: REDDIT_PASSWORD,
    });
    return _r;
}

function recipient(row) {
    const h = row.prospect?.handle || '';
    return h.replace(/^u\//, '').replace(/^\/u\//, '').trim();
}

export const reddit_dm = {
    async send(row) {
        const to = recipient(row);
        if (!to) return { ok: false, error: 'No reddit recipient' };
        try {
            await client().composeMessage({ to, subject: row.subject || 'Hey', text: row.body });
            return { ok: true, externalUrl: `https://www.reddit.com/message/sent/` };
        } catch (e) {
            return { ok: false, error: String(e.message || e) };
        }
    },
};

export const reddit_comment = {
    async send(row) {
        const postUrl = row.prospect?.post_url || '';
        const m = postUrl.match(/\/comments\/([a-z0-9]+)/i);
        if (!m) return { ok: false, error: 'No reddit post id — prospect.post_url missing' };
        try {
            const submission = client().getSubmission(m[1]);
            const reply = await submission.reply(row.body);
            return { ok: true, externalId: reply.id, externalUrl: `https://reddit.com${reply.permalink}` };
        } catch (e) {
            return { ok: false, error: String(e.message || e) };
        }
    },
};
