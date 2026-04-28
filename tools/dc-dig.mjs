import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'tools/dartcounter-dump/app.dartcounter.net';

function snippets(file, rx, ctx = 80) {
    const t = readFileSync(join(dir, file), 'utf8');
    const out = [];
    let m, count = 0;
    while ((m = rx.exec(t)) && count < 6) {
        const s = Math.max(0, m.index - ctx);
        const e = Math.min(t.length, m.index + m[0].length + ctx);
        out.push(t.slice(s, e).replace(/\s+/g, ' '));
        count++;
        rx.lastIndex = e;
    }
    return out;
}

const probes = [
    ['chunk-ZEHSOYIP.js',  /SpeechRecognition[^,;{]{0,120}/g, 'voice'],
    ['main-JRR6KBXS.js',   /SpeechRecognition[^,;{]{0,120}/g, 'voice-main'],
    ['chunk-2P3TELBR.js',  /(submitScore|inputScore|enterScore|registerScore|throwDart|recordThrow|saveThrow)[\w$]*\s*[:=(]/g, 'score'],
    ['chunk-HGI3STWK.js',  /(submitScore|inputScore|enterScore|registerScore|throwDart|recordThrow|saveThrow)[\w$]*\s*[:=(]/g, 'score'],
    ['chunk-A5QLHA6N.js',  /(submitScore|inputScore|enterScore|registerScore|throwDart|recordThrow|saveThrow)[\w$]*\s*[:=(]/g, 'score'],
    ['chunk-GFFJN2CX.js',  /(submitScore|inputScore|enterScore|registerScore|throwDart|recordThrow|saveThrow)[\w$]*\s*[:=(]/g, 'score'],
    ['chunk-6C57V6BD.js',  /(checkout|outshot|finishCombo|getCheckout)[\w$]*\s*[:=(]/g, 'checkout'],
    ['main-JRR6KBXS.js',   /(loadChildren|loadComponent)\s*:\s*[^,]{0,100}/g, 'routes'],
    ['main-JRR6KBXS.js',   /\bpath\s*:\s*['"][^'"]{1,40}['"]/g, 'route-paths'],
    ['main-JRR6KBXS.js',   /(firebaseio\.com|firebaseapp\.com|googleapis\.com\/v[0-9])[^"',]{0,80}/g, 'firebase-cfg'],
    ['main-JRR6KBXS.js',   /apiKey\s*:\s*"[A-Za-z0-9_\-]{20,}"/g, 'apiKey'],
];

const out = {};
for (const [file, rx, label] of probes) {
    try { out[`${label} (${file})`] = snippets(file, rx); }
    catch (e) { out[label] = ['err:' + e.message]; }
}
writeFileSync('tools/dartcounter-dump/_findings.json', JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) {
    console.log('\n## ' + k);
    v.forEach((s, i) => console.log(`  [${i}] …${s}…`));
}
