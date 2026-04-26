/**
 * One-shot migration: replace the Tailwind CDN runtime + inline
 * `tailwind.config = {…}` blocks with a <link> to the locally-built
 * css/tailwind.built.css.
 *
 * Idempotent — re-running on already-migrated files is a no-op.
 *
 * Usage:  node scripts/migrate-tailwind.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function listHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip noise dirs.
      if (['node_modules', '.git', 'build', 'dartvoice_unzipped', 'autoscore', 'chrome_extension', 'extension', 'docs', 'tools', 'scripts', 'tests', 'supabase', 'outreach-server', 'src', 'css', 'assets', 'downloads', 'emails', 'migrations'].includes(entry.name)) continue;
      out.push(...listHtmlFiles(full));
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function relativeToBuiltCss(filePath) {
  const dir = path.dirname(filePath);
  let rel = path.relative(dir, path.join(ROOT, 'css', 'tailwind.built.css'));
  return rel.split(path.sep).join('/');
}

const CDN_RE = /\s*<script\s+src=(["'])https:\/\/cdn\.tailwindcss\.com\1\s*><\/script>/i;
// Greedy across the inline config block following the CDN tag (or anywhere).
// Matches both pretty-printed and minified forms.
// Allow optional trailing `;` (and any whitespace) after the closing `}`.
const INLINE_CFG_RE = /\s*<script>\s*tailwind\.config\s*=\s*\{[\s\S]*?\}\s*;?\s*<\/script>/gi;

let changedCount = 0;
const files = listHtmlFiles(ROOT);

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  if (!CDN_RE.test(src) && !/tailwind\.config\s*=/.test(src)) continue;

  const builtPath = relativeToBuiltCss(file);
  const linkTag = `<link rel="stylesheet" href="${builtPath}">`;
  let next = src;

  // 1. Replace the CDN <script> tag with the <link>.
  if (CDN_RE.test(next)) {
    next = next.replace(CDN_RE, `\n    ${linkTag}`);
  } else {
    // Already migrated CDN line, but inline config might still be lingering.
    // Make sure the link is present somewhere, otherwise inject before </head>.
    if (!next.includes('tailwind.built.css')) {
      next = next.replace(/<\/head>/i, `    ${linkTag}\n</head>`);
    }
  }

  // 2. Strip every inline tailwind.config block.
  next = next.replace(INLINE_CFG_RE, '');

  if (next !== src) {
    fs.writeFileSync(file, next, 'utf8');
    changedCount++;
    console.log('updated', path.relative(ROOT, file));
  }
}

console.log(`\nDone. ${changedCount} file(s) updated of ${files.length} scanned.`);
