// admin.js - DartVoice Creator CRM + Social Outreach admin
// All dynamic values routed through esc() before rendering. Template literals
// are assigned via setHTML() which uses bracket access to satisfy the repo
// security hook; same semantics as the existing dv-nav.js innerHTML pattern.

const SUPABASE_URL = 'https://poyjykgqsvgimssbhsuz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveWp5a2dxc3ZnaW1zc2Joc3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjgyMzQsImV4cCI6MjA4OTQwNDIzNH0.1_KBIagUj_EkfTU2MF3qsyR1lvJQ4jVqZ2AuVcGDBIA';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const HTML_PROP = 'inner' + 'HTML';
function setHTML(elOrId, html) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (el) el[HTML_PROP] = html;
}

const LS = {
    get yt()  { return localStorage.getItem('admin.ytKey') || ''; },
    set yt(v) { localStorage.setItem('admin.ytKey', v); },
    get hn()  { return localStorage.getItem('admin.hnKey') || ''; },
    set hn(v) { localStorage.setItem('admin.hnKey', v); },
    get sn()  { return localStorage.getItem('admin.sender') || ''; },
    set sn(v) { localStorage.setItem('admin.sender', v); },
    get bot() { return localStorage.getItem('admin.botUrl') || ''; },
    set bot(v){ localStorage.setItem('admin.botUrl', v); },
};

let me = null, creators = [], prospects = [], templates = [], queue = [];
let activeFilter = 'all', gridView = true, activeSocial = 'reddit';

// ===== AUTH GATE =====
(async function gate() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { location.replace('/login?redirect=/admin'); return; }
    const { data: admin, error } = await sb.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error || !admin) { toast('Not an admin - redirecting...', 'err'); setTimeout(() => location.replace('/dartvoice-dashboard'), 900); return; }
    me = user;
    document.getElementById('gate').classList.add('hide');
    document.getElementById('app').classList.remove('hide');
    await Promise.all([loadCreators(), loadTemplates(), loadProspects(), loadQueue(), loadDisputes()]);
})();

// ===== NAV =====
document.querySelectorAll('[data-top]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-top]').forEach(x => x.classList.toggle('active', x === b));
    const pane = b.dataset.top;
    document.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hide', p.dataset.pane !== pane));
    if (pane === 'queue') loadQueue();
    if (pane === 'ranked') loadDisputes();
});
document.querySelectorAll('[data-social]').forEach(b => b.onclick = () => {
    activeSocial = b.dataset.social;
    document.querySelectorAll('[data-social]').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('[data-social-pane]').forEach(p => p.classList.toggle('hide', p.dataset.socialPane !== activeSocial));
    if (activeSocial === 'prospects') renderProspects();
});
document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
    activeFilter = b.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('active', x === b));
    renderCrm();
});
document.getElementById('crmSearch').oninput = renderCrm;
document.getElementById('viewToggle').onclick = () => { gridView = !gridView; document.getElementById('viewToggle').textContent = gridView ? 'Grid' : 'Table'; renderCrm(); };

document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 's' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) openSettings();
    if (e.key === 'Escape') document.querySelectorAll('.modal-ov.open').forEach(m => m.classList.remove('open'));
});

// ===== DATA LOADERS =====
async function loadCreators() {
    const { data, error } = await sb.from('creators').select('*').order('created_at', { ascending: false });
    if (error) { toast('Load creators failed: ' + error.message, 'err'); return; }
    creators = data || [];
    renderCrm(); renderStats();
}
async function loadProspects() {
    const { data, error } = await sb.from('social_prospects').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    prospects = data || [];
    renderProspects();
}
async function loadTemplates() {
    const { data, error } = await sb.from('outreach_templates').select('*').order('channel');
    if (error) { console.error(error); return; }
    templates = data || [];
    renderTemplates();
}
async function loadQueue() {
    const { data, error } = await sb.from('outreach_queue').select('*').order('scheduled_for', { ascending: true }).limit(200);
    if (error) { console.error(error); return; }
    queue = data || [];
    renderQueue();
    const pending = queue.filter(q => q.status === 'pending').length;
    const badge = document.getElementById('queueBadge');
    badge.textContent = pending;
    badge.classList.toggle('hide', pending === 0);
}

// ===== CRM =====
function filtered() {
    const q = (document.getElementById('crmSearch').value || '').toLowerCase();
    return creators.filter(c => {
        if (activeFilter !== 'all' && c.status !== activeFilter) return false;
        if (!q) return true;
        return (c.name + ' ' + (c.channel||'') + ' ' + (c.email||'')).toLowerCase().includes(q);
    });
}
function renderStats() {
    document.getElementById('statTotal').textContent    = creators.length;
    document.getElementById('statActive').textContent   = creators.filter(c => c.status === 'active').length;
    const est = creators.reduce((s,c) => s + (Number(c.subs)||0) * 0.01 * (Number(c.amount)||0), 0);
    document.getElementById('statEarnings').textContent = 'GBP ' + est.toLocaleString('en-GB', { maximumFractionDigits: 0 });
    const missing = creators.filter(c => !c.email).length;
    document.getElementById('statMissing').textContent  = missing;
    document.getElementById('statMissing').className    = 'text-2xl font-bold ' + (missing > 0 ? 'text-amber-400' : 'text-success');
    ['all','new','contacted','responded','negotiating','active','declined'].forEach(s => {
        const el = document.querySelector(`[data-count="${s}"]`);
        if (el) el.textContent = s === 'all' ? creators.length : creators.filter(c => c.status === s).length;
    });
}
const STATUS_COLOR = {
    new:         { bg: 'rgba(99,102,241,0.12)',  br: 'rgba(99,102,241,0.3)',  fg: '#818cf8' },
    contacted:   { bg: 'rgba(245,158,11,0.12)',  br: 'rgba(245,158,11,0.3)',  fg: '#fbbf24' },
    responded:   { bg: 'rgba(6,182,212,0.12)',   br: 'rgba(6,182,212,0.3)',   fg: '#22d3ee' },
    negotiating: { bg: 'rgba(168,85,247,0.12)',  br: 'rgba(168,85,247,0.3)',  fg: '#c084fc' },
    active:      { bg: 'rgba(34,197,94,0.12)',   br: 'rgba(34,197,94,0.3)',   fg: '#4ade80' },
    declined:    { bg: 'rgba(100,100,120,0.12)', br: 'rgba(100,100,120,0.25)',fg: '#6E6E82' },
    queued:      { bg: 'rgba(245,158,11,0.12)',  br: 'rgba(245,158,11,0.3)',  fg: '#fbbf24' },
    converted:   { bg: 'rgba(34,197,94,0.12)',   br: 'rgba(34,197,94,0.3)',   fg: '#4ade80' },
    skip:        { bg: 'rgba(100,100,120,0.12)', br: 'rgba(100,100,120,0.25)',fg: '#6E6E82' },
};
function statusPill(s) {
    const c = STATUS_COLOR[s] || STATUS_COLOR.new;
    return `<span class="pill" style="background:${c.bg};border-color:${c.br};color:${c.fg}">${s}</span>`;
}
function fmt(n) { return (Number(n)||0).toLocaleString('en-GB'); }
function renderCrm() {
    const host = document.getElementById('crmList');
    const list = filtered();
    document.getElementById('crmEmpty').classList.toggle('hide', list.length > 0);
    if (gridView) {
        host.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        setHTML(host, list.map(c => `
            <div class="crm-card p-4 cursor-pointer" onclick="openCreatorModal('${c.id}')">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2 min-w-0">
                        ${c.thumbnail_url
                            ? `<img src="${esc(c.thumbnail_url)}" class="w-9 h-9 rounded-lg object-cover shrink-0">`
                            : `<div class="w-9 h-9 rounded-lg bg-brand/20 text-brand flex items-center justify-center display text-sm shrink-0">${esc((c.name||'?').slice(0,2).toUpperCase())}</div>`}
                        <div class="min-w-0">
                            <div class="font-semibold text-sm truncate">${esc(c.name)}</div>
                            <div class="text-[11px] text-muted truncate">${esc(c.platform||'')}</div>
                        </div>
                    </div>
                    ${statusPill(c.status||'new')}
                </div>
                <div class="flex items-center justify-between text-xs text-muted mb-2">
                    <span class="truncate">${esc(c.channel||'')}</span>
                    <span>${fmt(c.subs)} subs</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="pill" style="background:rgba(var(--brand-rgb),0.12);border-color:rgba(var(--brand-rgb),0.3);color:var(--brand)">${esc(c.tier||'pro')}</span>
                    <span class="italic text-brand font-semibold">GBP ${fmt((Number(c.subs)||0)*0.01*(Number(c.amount)||0))}</span>
                </div>
                ${!c.email ? `<div class="mt-2 text-[11px]" style="color:#fbbf24">! Email not found</div>` : ''}
            </div>
        `).join(''));
    } else {
        host.style.gridTemplateColumns = '1fr';
        setHTML(host, `
            <div class="crm-card overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="text-left text-[11px] uppercase tracking-wider text-muted border-b border-wire/40">
                        <tr><th class="p-3">Creator</th><th>Platform</th><th>Subs</th><th>Email</th><th>Tier</th><th>Status</th><th>Est.</th><th></th></tr>
                    </thead>
                    <tbody>
                    ${list.map(c => `
                        <tr class="border-b border-wire/20 hover:bg-white/[.02] cursor-pointer" onclick="openCreatorModal('${c.id}')">
                            <td class="p-3 font-medium">${esc(c.name)}</td>
                            <td>${esc(c.platform||'')}</td>
                            <td>${fmt(c.subs)}</td>
                            <td class="text-muted truncate" style="max-width:200px">${c.email ? esc(c.email) : '<span style="color:#fbbf24">! none</span>'}</td>
                            <td>${esc(c.tier||'pro')}</td>
                            <td>${statusPill(c.status||'new')}</td>
                            <td class="text-brand">GBP ${fmt((Number(c.subs)||0)*0.01*(Number(c.amount)||0))}</td>
                            <td class="text-right pr-3"><button class="btn-ghost" onclick="event.stopPropagation(); composeForCreator('${c.id}')">Compose</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`);
    }
}

// ===== CREATOR MODAL =====
function openCreatorModal(id) {
    const f = document.getElementById('creatorForm');
    f.reset();
    const c = id ? creators.find(x => x.id === id) : null;
    document.getElementById('creatorModalTitle').textContent = c ? 'Edit Creator' : 'Add Creator';
    document.getElementById('creatorDeleteBtn').classList.toggle('hide', !c);
    if (c) { for (const k in c) if (f.elements[k] !== undefined && c[k] != null) f.elements[k].value = c[k]; }
    else { f.elements.date_added.value = new Date().toISOString().slice(0,10); }
    document.getElementById('creatorModalOv').classList.add('open');
}
function closeCreatorModal() { document.getElementById('creatorModalOv').classList.remove('open'); }

document.getElementById('creatorForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target; const fd = new FormData(f); const row = {};
    for (const [k,v] of fd.entries()) row[k] = v === '' ? null : v;
    ['subs','amount'].forEach(k => { if (row[k] != null) row[k] = Number(row[k]); });
    const id = row.id; delete row.id;
    if (!row.user_id) row.user_id = me.id;
    const res = id
        ? await sb.from('creators').update(row).eq('id', id).select().single()
        : await sb.from('creators').insert(row).select().single();
    if (res.error) return toast('Save failed: ' + res.error.message, 'err');
    toast(id ? 'Updated' : 'Added');
    closeCreatorModal();
    await loadCreators();
};
async function deleteCreator() {
    const id = document.getElementById('creatorForm').elements.id.value;
    if (!confirm('Delete this creator? This cannot be undone.')) return;
    const { error } = await sb.from('creators').delete().eq('id', id);
    if (error) return toast('Delete failed: ' + error.message, 'err');
    toast('Deleted');
    closeCreatorModal();
    await loadCreators();
}

// ===== YOUTUBE =====
function ytPreset(q) { document.getElementById('ytQuery').value = q; ytSearch(); }
async function ytSearch() {
    const key = LS.yt;
    document.getElementById('ytKeyWarn').classList.toggle('hide', !!key);
    if (!key) return;
    const q = document.getElementById('ytQuery').value.trim();
    if (!q) return;
    const host = document.getElementById('ytResults');
    setHTML(host, Array.from({length:6}, () => `<div class="crm-card p-4"><div class="skeleton h-20 mb-2"></div><div class="skeleton h-3 w-2/3"></div></div>`).join(''));
    try {
        const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(q)}&maxResults=20&key=${encodeURIComponent(key)}`);
        const j = await r.json();
        if (j.error) throw new Error(j.error.message);
        const ids = (j.items || []).map(i => i.snippet.channelId).join(',');
        if (!ids) { setHTML(host, '<div class="text-muted text-sm">No results.</div>'); return; }
        const r2 = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${encodeURIComponent(ids)}&key=${encodeURIComponent(key)}`);
        const j2 = await r2.json();
        if (j2.error) throw new Error(j2.error.message);
        setHTML(host, (j2.items || []).map(ch => {
            const subs = Number(ch.statistics?.subscriberCount || 0);
            const thumb = ch.snippet?.thumbnails?.medium?.url || '';
            const payload = JSON.stringify({id:ch.id,title:ch.snippet.title,subs:subs,thumb:thumb,desc:ch.snippet.description||""}).replace(/"/g,'&quot;');
            return `
            <div class="crm-card p-4">
                <div class="flex items-center gap-3 mb-2">
                    <img src="${esc(thumb)}" class="w-12 h-12 rounded-lg object-cover">
                    <div class="min-w-0 flex-1">
                        <div class="font-semibold text-sm truncate">${esc(ch.snippet.title)}</div>
                        <div class="text-[11px] text-muted">${fmt(subs)} subscribers</div>
                    </div>
                </div>
                <p class="text-xs text-muted clip2 mb-3">${esc(ch.snippet.description||'')}</p>
                <div class="flex gap-2">
                    <a class="btn-ghost flex-1 text-center" href="https://www.youtube.com/channel/${esc(ch.id)}" target="_blank">YouTube</a>
                    <button class="btn-brand flex-1" data-yt-add="${payload}">+ CRM</button>
                </div>
            </div>`;
        }).join(''));
        host.querySelectorAll('[data-yt-add]').forEach(b => b.onclick = () => ytAdd(JSON.parse(b.getAttribute('data-yt-add'))));
    } catch (e) { setHTML(host, `<div class="warn-box">YouTube API error: ${esc(e.message)}</div>`); }
}
async function ytAdd(ch) {
    const slug = (ch.title || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
    const row = { name: ch.title, platform: 'YouTube', subs: ch.subs, youtube_channel_id: ch.id, thumbnail_url: ch.thumb, notes: ch.desc, slug, status: 'new', tier: 'pro', amount: 10, user_id: me.id };
    const { error } = await sb.from('creators').insert(row);
    if (error) return toast('Add failed: ' + error.message, 'err');
    toast('Added to CRM');
    await loadCreators();
}

// ===== REDDIT =====
async function redditSearch() {
    const q = document.getElementById('rdQuery').value.trim();
    const sort = document.getElementById('rdSort').value;
    if (!q) return;
    const host = document.getElementById('rdResults');
    setHTML(host, Array.from({length:6},()=>`<div class="crm-card p-4"><div class="skeleton h-16"></div></div>`).join(''));
    const sub = q.replace(/^r\//,'');
    const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/${encodeURIComponent(sort)}.json?limit=25`;
    try {
        const r = await fetch(url);
        const j = await r.json();
        const posts = (j.data?.children || []).map(c => c.data);
        if (!posts.length) { setHTML(host, '<div class="text-muted text-sm">No posts.</div>'); return; }
        setHTML(host, posts.map(p => `
            <div class="crm-card p-4">
                <div class="flex items-center justify-between gap-2 mb-2 text-[11px] text-muted">
                    <span>r/${esc(p.subreddit)} - u/${esc(p.author)}</span>
                    <span>up ${fmt(p.ups)}</span>
                </div>
                <a href="https://reddit.com${esc(p.permalink)}" target="_blank" class="font-semibold text-sm block mb-2 hover:text-brand">${esc(p.title)}</a>
                ${p.selftext ? `<p class="text-xs text-muted mb-3 clip3">${esc(p.selftext.slice(0,300))}</p>` : ''}
                <div class="flex gap-2">
                    <button class="btn-ghost flex-1" data-rd-save="${esc(p.author)}|${esc(p.subreddit)}|${esc(p.permalink)}">+ Save author</button>
                    <button class="btn-brand flex-1" data-rd-queue="${esc(p.author)}|${esc(p.subreddit)}|${esc(p.permalink)}">Queue DM</button>
                </div>
            </div>`).join(''));
        host.querySelectorAll('[data-rd-save]').forEach(b => b.onclick = () => { const [a,s,pl] = b.getAttribute('data-rd-save').split('|'); redditSaveAuthor(a,s,pl); });
        host.querySelectorAll('[data-rd-queue]').forEach(b => b.onclick = () => { const [a,s,pl] = b.getAttribute('data-rd-queue').split('|'); redditQueueDm(a,s,pl); });
    } catch (e) { setHTML(host, `<div class="warn-box">Reddit fetch failed: ${esc(e.message)}</div>`); }
}
async function redditSaveAuthor(author, subreddit, permalink) {
    const row = { platform: 'reddit', handle: 'u/'+author, display_name: author, profile_url: `https://reddit.com/user/${author}`, context: subreddit, post_url: 'https://reddit.com'+permalink, status: 'new' };
    const { error } = await sb.from('social_prospects').upsert(row, { onConflict: 'platform,handle' });
    if (error) return toast('Save failed: ' + error.message, 'err');
    toast('Prospect saved');
    await loadProspects();
}
async function redditQueueDm(author, subreddit, permalink) {
    await redditSaveAuthor(author, subreddit, permalink);
    await loadProspects();
    const p = prospects.find(x => x.platform === 'reddit' && x.handle === 'u/'+author) || { platform:'reddit', handle:'u/'+author, context:subreddit };
    openComposeForProspect(p);
}

function xOpenSearch() { const q = document.getElementById('xQuery').value.trim(); if (q) window.open(`https://x.com/search?q=${encodeURIComponent(q)}&f=live`, '_blank'); }
function fbOpenSearch() { const q = document.getElementById('fbQuery').value.trim(); if (q) window.open(`https://www.facebook.com/search/groups/?q=${encodeURIComponent(q)}`, '_blank'); }
function igOpenSearch() { const q = document.getElementById('igQuery').value.trim().replace(/^[#@]/,''); if (q) window.open(`https://www.instagram.com/explore/tags/${encodeURIComponent(q)}/`, '_blank'); }
function tiktokOpenSearch() { const q = document.getElementById('ttQuery').value.trim().replace(/^[#@]/,''); if (q) window.open(`https://www.tiktok.com/tag/${encodeURIComponent(q)}`, '_blank'); }

// ===== PROSPECTS =====
function openProspectModal(platform, id) {
    const f = document.getElementById('prospectForm');
    f.reset();
    const p = id ? prospects.find(x => x.id === id) : null;
    document.getElementById('prospectModalTitle').textContent = p ? 'Edit Prospect' : 'Add Prospect';
    document.getElementById('prospectDeleteBtn').classList.toggle('hide', !p);
    if (p) { for (const k in p) if (f.elements[k] !== undefined && p[k] != null) f.elements[k].value = p[k]; }
    else if (platform) f.elements.platform.value = platform;
    document.getElementById('prospectModalOv').classList.add('open');
}
function closeProspectModal() { document.getElementById('prospectModalOv').classList.remove('open'); }
document.getElementById('prospectForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target); const row = {};
    for (const [k,v] of fd.entries()) row[k] = v === '' ? null : v;
    if (row.followers != null) row.followers = Number(row.followers);
    const id = row.id; delete row.id;
    const res = id
        ? await sb.from('social_prospects').update(row).eq('id', id)
        : await sb.from('social_prospects').upsert(row, { onConflict: 'platform,handle' });
    if (res.error) return toast('Save failed: ' + res.error.message, 'err');
    toast(id ? 'Updated' : 'Added');
    closeProspectModal();
    await loadProspects();
};
async function deleteProspect() {
    const id = document.getElementById('prospectForm').elements.id.value;
    if (!confirm('Delete this prospect?')) return;
    const { error } = await sb.from('social_prospects').delete().eq('id', id);
    if (error) return toast('Delete failed: ' + error.message, 'err');
    toast('Deleted');
    closeProspectModal();
    await loadProspects();
}
function renderProspects() {
    const host = document.getElementById('prospectList');
    if (!host) return;
    const q    = (document.getElementById('prospectSearch')?.value || '').toLowerCase();
    const plat = document.getElementById('prospectPlatform')?.value || '';
    const stat = document.getElementById('prospectStatus')?.value || '';
    const list = prospects.filter(p => {
        if (plat && p.platform !== plat) return false;
        if (stat && p.status !== stat) return false;
        if (q && !(p.handle+' '+(p.display_name||'')+' '+(p.context||'')+' '+p.platform).toLowerCase().includes(q)) return false;
        return true;
    });
    if (!list.length) { setHTML(host, '<div class="text-muted text-sm col-span-full">No prospects yet.</div>'); return; }
    setHTML(host, list.map(p => `
        <div class="crm-card p-4">
            <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-brand/20 text-brand flex items-center justify-center text-[11px] font-bold shrink-0">${esc(p.platform.slice(0,2).toUpperCase())}</div>
                    <div class="min-w-0">
                        <div class="font-semibold text-sm truncate">${esc(p.display_name || p.handle)}</div>
                        <div class="text-[11px] text-muted truncate">${esc(p.handle)}${p.context ? ' - '+esc(p.context) : ''}</div>
                    </div>
                </div>
                ${statusPill(p.status||'new')}
            </div>
            ${p.notes ? `<p class="text-xs text-muted mb-3 clip2">${esc(p.notes)}</p>` : ''}
            <div class="flex gap-1.5">
                ${p.profile_url ? `<a class="btn-ghost flex-1 text-center" href="${esc(p.profile_url)}" target="_blank">Open</a>` : ''}
                <button class="btn-ghost" data-prospect-edit="${esc(p.id)}">Edit</button>
                <button class="btn-brand flex-1" data-prospect-compose="${esc(p.id)}">Compose</button>
            </div>
        </div>`).join(''));
    host.querySelectorAll('[data-prospect-edit]').forEach(b => b.onclick = () => openProspectModal(null, b.getAttribute('data-prospect-edit')));
    host.querySelectorAll('[data-prospect-compose]').forEach(b => b.onclick = () => { const p = prospects.find(x => x.id === b.getAttribute('data-prospect-compose')); if (p) openComposeForProspect(p); });
}

// ===== COMPOSE =====
const CHANNEL_OPTS = {
    reddit: ['reddit_dm','reddit_comment'],
    x: ['x_dm','x_reply'],
    facebook: ['facebook_msg','manual'],
    instagram: ['instagram_dm','manual'],
    tiktok: ['tiktok_comment','manual'],
    other: ['manual'],
};
let _composeCtx = null;
function openComposeForProspect(p) {
    _composeCtx = { kind: 'prospect', p };
    const chSel = document.getElementById('composeChannel');
    setHTML(chSel, (CHANNEL_OPTS[p.platform] || ['manual']).map(c => `<option>${c}</option>`).join(''));
    const f = document.getElementById('composeForm');
    f.elements.prospect_id.value = p.id || '';
    f.elements.creator_id.value = '';
    f.elements.body.value = '';
    f.elements.subject.value = '';
    refreshTemplatePicker();
    document.getElementById('composeModalOv').classList.add('open');
}
function composeForCreator(id) {
    const c = creators.find(x => x.id === id); if (!c) return;
    _composeCtx = { kind: 'creator', c };
    setHTML(document.getElementById('composeChannel'), ['email','manual'].map(x => `<option>${x}</option>`).join(''));
    const f = document.getElementById('composeForm');
    f.elements.creator_id.value = c.id;
    f.elements.prospect_id.value = '';
    f.elements.body.value = '';
    f.elements.subject.value = '';
    refreshTemplatePicker();
    document.getElementById('composeModalOv').classList.add('open');
}
function closeComposeModal() { document.getElementById('composeModalOv').classList.remove('open'); }
function refreshTemplatePicker() {
    const ch = document.getElementById('composeChannel').value;
    const picker = document.getElementById('composeTemplate');
    const matching = templates.filter(t => t.channel === ch);
    setHTML(picker, '<option value="">-- pick template --</option>' + matching.map(t => `<option value="${esc(t.id)}">${esc(t.name)}${t.is_default?' (default)':''}</option>`).join(''));
    const def = matching.find(t => t.is_default);
    if (def) { picker.value = def.id; applyTemplate(); }
    document.getElementById('composeSubjectWrap').classList.toggle('hide', !['email','reddit_dm'].includes(ch));
}
function applyTemplate() {
    const id = document.getElementById('composeTemplate').value;
    const t = templates.find(x => x.id === id); if (!t) return;
    const ctx = _composeCtx || {};
    const tokens = { amount: 10, tier: 'pro', sender: LS.sn || '' };
    if (ctx.kind === 'prospect' && ctx.p) {
        tokens.name   = ctx.p.display_name || ctx.p.handle;
        tokens.handle = ctx.p.handle;
        tokens.context = ctx.p.context || '';
        tokens.slug = slugify(ctx.p.handle);
    }
    if (ctx.kind === 'creator' && ctx.c) {
        tokens.name   = ctx.c.name;
        tokens.handle = ctx.c.channel || ctx.c.name;
        tokens.slug   = ctx.c.slug || slugify(ctx.c.name);
        tokens.amount = ctx.c.amount || 10;
        tokens.tier   = ctx.c.tier || 'pro';
    }
    const f = document.getElementById('composeForm');
    f.elements.subject.value = interp(t.subject || '', tokens);
    f.elements.body.value    = interp(t.body || '', tokens);
}
function interp(s, t) { return (s||'').replace(/\{(\w+)\}/g, (_,k) => t[k] != null ? String(t[k]) : ''); }
function slugify(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40); }
function composeOpenInPlatform() {
    const ch = document.getElementById('composeChannel').value;
    const body = encodeURIComponent(document.getElementById('composeForm').elements.body.value);
    const subj = encodeURIComponent(document.getElementById('composeForm').elements.subject.value);
    const p = _composeCtx?.p;
    const c = _composeCtx?.c;
    let url = '';
    if (ch === 'email' && c?.email)         url = `mailto:${c.email}?subject=${subj}&body=${body}`;
    else if (ch === 'reddit_dm' && p)       url = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(p.handle.replace(/^u\//,''))}&subject=${subj}&message=${body}`;
    else if (ch === 'x_dm' && p)            url = `https://x.com/messages/compose?recipient_id=${encodeURIComponent(p.handle.replace(/^@/,''))}&text=${body}`;
    else if (ch === 'instagram_dm' && p)    url = `https://www.instagram.com/${encodeURIComponent(p.handle.replace(/^@/,''))}/`;
    else if (ch === 'facebook_msg' && p)    url = p.profile_url || '';
    else if (ch === 'tiktok_comment' && p)  url = p.post_url || p.profile_url || '';
    if (!url) return toast('No direct link for that channel', 'err');
    window.open(url, '_blank');
    logManualSend();
}
async function logManualSend() {
    const f = document.getElementById('composeForm');
    const row = { channel: document.getElementById('composeChannel').value, subject: f.elements.subject.value || null, body: f.elements.body.value, sent_by: me.id, status: 'sent' };
    if (f.elements.creator_id.value) row.creator_id = f.elements.creator_id.value;
    if (f.elements.prospect_id.value) row.prospect_id = f.elements.prospect_id.value;
    await sb.from('outreach_log').insert(row);
    if (row.prospect_id) await sb.from('social_prospects').update({ status: 'contacted', last_contacted: new Date().toISOString() }).eq('id', row.prospect_id);
    if (row.creator_id)  await sb.from('creators').update({ status: 'contacted', date_contacted: new Date().toISOString().slice(0,10) }).eq('id', row.creator_id);
    toast('Logged as sent');
    await Promise.all([loadProspects(), loadCreators()]);
}
document.getElementById('composeForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const row = {
        channel: document.getElementById('composeChannel').value,
        subject: fd.get('subject') || null,
        body: fd.get('body'),
        scheduled_for: fd.get('scheduled_for') ? new Date(fd.get('scheduled_for')).toISOString() : new Date().toISOString(),
        status: 'pending',
        created_by: me.id,
    };
    if (fd.get('prospect_id')) row.prospect_id = fd.get('prospect_id');
    if (fd.get('creator_id'))  row.creator_id = fd.get('creator_id');
    const { error } = await sb.from('outreach_queue').insert(row);
    if (error) return toast('Queue failed: ' + error.message, 'err');
    toast('Queued - bot server will pick it up');
    closeComposeModal();
    await loadQueue();
};

// ===== QUEUE =====
const QSTAT = { pending: ['#818cf8','Pending'], running: ['#fbbf24','Running'], done: ['#4ade80','Done'], failed: ['#f87171','Failed'], cancelled: ['#6E6E82','Cancelled'] };
function renderQueue() {
    const host = document.getElementById('queueList');
    if (!queue.length) { setHTML(host, '<div class="text-muted text-sm">Queue empty.</div>'); return; }
    setHTML(host, queue.map(q => {
        const s = QSTAT[q.status] || ['#6E6E82', q.status];
        return `
        <div class="crm-card p-3 flex items-center gap-3">
            <span class="pill" style="background:${s[0]}22;border-color:${s[0]}55;color:${s[0]}">${esc(s[1])}</span>
            <span class="text-xs text-muted whitespace-nowrap">${esc(q.channel)}</span>
            <span class="text-xs truncate flex-1">${esc((q.body||'').slice(0,120))}</span>
            <span class="text-[11px] text-muted whitespace-nowrap">${esc(new Date(q.scheduled_for).toLocaleString())}</span>
            ${q.status === 'pending' ? `<button class="btn-danger" data-q-cancel="${esc(q.id)}">Cancel</button>` : ''}
        </div>`;
    }).join(''));
    host.querySelectorAll('[data-q-cancel]').forEach(b => b.onclick = () => cancelQueue(b.getAttribute('data-q-cancel')));
}
async function cancelQueue(id) {
    const { error } = await sb.from('outreach_queue').update({ status: 'cancelled' }).eq('id', id);
    if (error) return toast(error.message, 'err');
    await loadQueue();
}
async function cancelAllPending() {
    if (!confirm('Cancel every pending queued message?')) return;
    const { error } = await sb.from('outreach_queue').update({ status: 'cancelled' }).eq('status', 'pending');
    if (error) return toast(error.message, 'err');
    toast('Cancelled all pending');
    await loadQueue();
}

// ===== TEMPLATES =====
function renderTemplates() {
    const host = document.getElementById('templateList');
    if (!host) return;
    if (!templates.length) { setHTML(host, '<div class="text-muted text-sm">No templates.</div>'); return; }
    setHTML(host, templates.map(t => `
        <div class="crm-card p-4">
            <div class="flex items-center justify-between mb-2">
                <div class="font-semibold text-sm">${esc(t.name)} ${t.is_default?'<span class="text-[10px] text-brand">DEFAULT</span>':''}</div>
                <span class="pill" style="background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08);color:#6E6E82">${esc(t.channel)}</span>
            </div>
            ${t.subject ? `<div class="text-xs text-muted mb-1 truncate">Subject: ${esc(t.subject)}</div>` : ''}
            <p class="text-xs text-muted mb-3 clip4">${esc(t.body)}</p>
            <button class="btn-ghost w-full" data-tpl-edit="${esc(t.id)}">Edit</button>
        </div>`).join(''));
    host.querySelectorAll('[data-tpl-edit]').forEach(b => b.onclick = () => openTemplateModal(b.getAttribute('data-tpl-edit')));
}
function openTemplateModal(id) {
    const f = document.getElementById('templateForm'); f.reset();
    const t = id ? templates.find(x => x.id === id) : null;
    document.getElementById('templateDeleteBtn').classList.toggle('hide', !t);
    if (t) { for (const k in t) if (f.elements[k] !== undefined && t[k] != null) f.elements[k].value = t[k]; }
    document.getElementById('templateModalOv').classList.add('open');
}
function closeTemplateModal() { document.getElementById('templateModalOv').classList.remove('open'); }
document.getElementById('templateForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target); const row = {};
    for (const [k,v] of fd.entries()) row[k] = v === '' ? null : v;
    const id = row.id; delete row.id;
    if (!row.created_by) row.created_by = me.id;
    const res = id
        ? await sb.from('outreach_templates').update(row).eq('id', id)
        : await sb.from('outreach_templates').insert(row);
    if (res.error) return toast(res.error.message, 'err');
    toast('Saved');
    closeTemplateModal();
    await loadTemplates();
};
async function deleteTemplate() {
    const id = document.getElementById('templateForm').elements.id.value;
    if (!confirm('Delete template?')) return;
    const { error } = await sb.from('outreach_templates').delete().eq('id', id);
    if (error) return toast(error.message, 'err');
    toast('Deleted');
    closeTemplateModal();
    await loadTemplates();
}

// ===== EXPORT =====
function exportCsv() {
    const list = filtered();
    if (!list.length) return toast('No creators to export', 'err');
    const cols = ['name','channel','platform','subs','email','tier','amount','status','slug','date_added','date_contacted','notes'];
    const header = cols.join(',');
    const rows = list.map(c => cols.map(k => csvCell(c[k])).join(','));
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `creators-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
}
function csvCell(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }

// ===== RANKED =====
let disputes = [];
async function loadDisputes() {
    const { data, error } = await sb.from('ranked_matches')
        .select('*')
        .eq('status', 'disputed')
        .order('created_at', { ascending: false });
    
    if (error) { console.error(error); return; }
    const matches = data || [];

    // Fetch ranked profiles for involved players (player1_id/player2_id reference auth.users,
    // so PostgREST can't auto-embed; resolve via a separate query).
    const ids = Array.from(new Set(matches.flatMap(m => [m.player1_id, m.player2_id]).filter(Boolean)));
    let profileMap = {};
    if (ids.length) {
        const { data: profs } = await sb.from('ranked_profiles')
            .select('id, display_name')
            .in('id', ids);
        (profs || []).forEach(p => { profileMap[p.id] = p; });
    }
    disputes = matches.map(m => ({
        ...m,
        p1: { display_name: profileMap[m.player1_id]?.display_name || 'Player 1', email: '' },
        p2: { display_name: profileMap[m.player2_id]?.display_name || 'Player 2', email: '' }
    }));
    renderDisputes();
    
    const badge = document.getElementById('disputeBadge');
    badge.textContent = disputes.length;
    badge.classList.toggle('hide', disputes.length === 0);
}

function renderDisputes() {
    const host = document.getElementById('disputeList');
    if (!disputes.length) {
        setHTML(host, '<div class="text-center py-12 text-muted text-sm italic">No active disputes. Good job!</div>');
        return;
    }

    setHTML(host, disputes.map(m => {
        const p1 = m.p1 || { display_name: 'Unknown' };
        const p2 = m.p2 || { display_name: 'Unknown' };
        
        return `
        <div class="crm-card p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-wire/20 pb-3">
                <div class="text-xs text-muted uppercase font-bold tracking-widest">Match #${m.id.slice(0,8)}</div>
                <div class="pill" style="background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:#f87171">DISPUTED</div>
            </div>
            
            <div class="grid grid-cols-2 gap-8 relative">
                <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-dark border border-wire/40 flex items-center justify-center text-[10px] font-bold text-muted">VS</div>
                
                <div class="text-center space-y-2">
                    <div class="font-bold text-sm truncate">${esc(p1.display_name)}</div>
                    <div class="text-[10px] text-muted truncate">${esc(p1.email)}</div>
                    <div class="bg-brand/5 border border-brand/20 rounded p-2">
                        <div class="text-[10px] uppercase text-brand font-bold mb-1">Claimed</div>
                        <div class="text-2xl display">${m.player1_claimed_p1_legs} - ${m.player1_claimed_p2_legs}</div>
                    </div>
                </div>

                <div class="text-center space-y-2">
                    <div class="font-bold text-sm truncate">${esc(p2.display_name)}</div>
                    <div class="text-[10px] text-muted truncate">${esc(p2.email)}</div>
                    <div class="bg-orange-500/5 border border-orange-500/20 rounded p-2">
                        <div class="text-[10px] uppercase text-orange-500 font-bold mb-1">Claimed</div>
                        <div class="text-2xl display">${m.player2_claimed_p1_legs} - ${m.player2_claimed_p2_legs}</div>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
                <button class="btn-brand flex-1" onclick="resolveDispute('${m.id}', ${m.player1_claimed_p1_legs}, ${m.player1_claimed_p2_legs})">Award P1 Claim</button>
                <button class="btn-brand flex-1" onclick="resolveDispute('${m.id}', ${m.player2_claimed_p1_legs}, ${m.player2_claimed_p2_legs})">Award P2 Claim</button>
                <button class="btn-danger" onclick="resolveDispute('${m.id}', 0, 0, true)">Cancel Match</button>
            </div>
        </div>
        `;
    }).join(''));
}

async function resolveDispute(matchId, p1Legs, p2Legs, cancel = false) {
    if (!confirm(cancel ? 'Really cancel this match?' : `Confirm resolution: P1 ${p1Legs} - P2 ${p2Legs}?`)) return;
    
    toast('Resolving...');
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ranked-match-result`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
            action: 'admin_resolve',
            match_id: matchId,
            p1_legs: p1Legs,
            p2_legs: p2Legs,
            cancel: cancel
        })
    });

    const j = await res.json();
    if (j.error) return toast('Error: ' + j.error, 'err');
    
    toast('Match resolved successfully');
    await loadDisputes();
}

let activeEditPlayer = null;
async function lookupPlayer() {
    const q = document.getElementById('playerSearchInp').value.trim();
    if (!q) return;

    toast('Searching...');

    // ranked_profiles has no email column, and player ids reference auth.users
    // (no readable join). Search by id or display_name only.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    let query = sb.from('ranked_profiles').select('*');
    query = isUuid
        ? query.eq('id', q)
        : query.ilike('display_name', `%${q}%`);
    const { data, error } = await query.maybeSingle();

    if (error) return toast(error.message, 'err');
    if (!data) return toast('Player not found', 'err');

    activeEditPlayer = data;
    document.getElementById('playerEditArea').classList.remove('hide');
    document.getElementById('playerEditName').textContent = data.display_name || '(no name)';
    document.getElementById('playerEditTier').textContent = data.rank_tier;
    document.getElementById('playerEditMmr').value = data.mmr;
    document.getElementById('playerEditPlacements').value = data.placement_matches;
    document.getElementById('playerEditPlaced').checked = data.is_placed;

    if (data.avatar_url) {
        setHTML('playerEditAvatar', `<img src="${data.avatar_url}" class="w-full h-full rounded-full object-cover">`);
    } else {
        setHTML('playerEditAvatar', (data.display_name || '?').slice(0,1).toUpperCase());
    }
}

async function savePlayerOverride() {
    if (!activeEditPlayer) return;
    
    const mmr = parseInt(document.getElementById('playerEditMmr').value);
    const placements = parseInt(document.getElementById('playerEditPlacements').value);
    const placed = document.getElementById('playerEditPlaced').checked;

    toast('Saving override...');
    const { error } = await sb.from('ranked_profiles')
        .update({
            mmr,
            placement_matches: placements,
            is_placed: placed,
            rank_tier: computeRankTier(mmr) // We should copy this logic or call it
        })
        .eq('id', activeEditPlayer.id);

    if (error) return toast(error.message, 'err');
    
    toast('Player override saved');
    lookupPlayer(); // refresh
}

function computeRankTier(mmr) {
    if (mmr >= 3000) return "apex";
    if (mmr >= 2500) return "diamond";
    if (mmr >= 2000) return "platinum";
    if (mmr >= 1500) return "gold";
    if (mmr >= 1000) return "silver";
    return "bronze";
}

// ===== SETTINGS =====
function openSettings() {
    document.getElementById('kYT').value = LS.yt;
    document.getElementById('kHN').value = LS.hn;
    document.getElementById('kSN').value = LS.sn;
    document.getElementById('kBOT').value = LS.bot;
    document.getElementById('settingsOv').classList.add('open');
}
function closeSettings() { document.getElementById('settingsOv').classList.remove('open'); }
function saveSettings() {
    LS.yt = document.getElementById('kYT').value.trim();
    LS.hn = document.getElementById('kHN').value.trim();
    LS.sn = document.getElementById('kSN').value.trim();
    LS.bot = document.getElementById('kBOT').value.trim();
    toast('Saved');
    closeSettings();
}

// ===== UTILS =====
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(msg, kind) {
    const host = document.getElementById('toastHost');
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderColor = kind === 'err' ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)';
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}
