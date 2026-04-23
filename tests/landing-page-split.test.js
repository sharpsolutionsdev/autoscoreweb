const fs = require('fs');
const assert = require('assert');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function has(text, pattern) {
  return pattern.test(text);
}

const indexHtml = read('index.html');
const featuresHtml = read('features.html');
const navJs = read('components/dv-nav.js');

assert.ok(fs.existsSync('how-it-works.html'), 'how-it-works.html should exist');

const howHtml = read('how-it-works.html');

assert.ok(
  has(navJs, /href="\/features\.html"/) || has(indexHtml, /href="features\.html"/),
  'navigation should link to features.html'
);

assert.ok(
  has(navJs, /href="\/how-it-works\.html"/) || has(indexHtml, /href="how-it-works\.html"/),
  'navigation should link to how-it-works.html'
);

assert.ok(!has(indexHtml, /<section id="features"/), 'index.html should no longer include the full features section');
assert.ok(!has(indexHtml, /<section id="deep-dive"/), 'index.html should no longer include the deep dive section');
assert.ok(!has(indexHtml, /<section id="scoring-modes"/), 'index.html should no longer include the scoring modes section');
assert.ok(!has(indexHtml, /<section id="how-it-works"/), 'index.html should no longer include the how it works section');

assert.ok(has(featuresHtml, /<section id="features"/), 'features.html should contain the features section');
assert.ok(has(featuresHtml, /<section id="deep-dive"/), 'features.html should contain the deep dive section');
assert.ok(has(featuresHtml, /<section id="scoring-modes"/), 'features.html should contain the scoring modes section');
assert.ok(!has(featuresHtml, /THREE STEPS TO THE OCHE/), 'features.html should not contain the how it works section');

assert.ok(has(howHtml, /THREE STEPS TO THE OCHE/), 'how-it-works.html should contain the how it works section');
assert.ok(has(howHtml, /BUILT FOR REAL PLAYERS/), 'how-it-works.html should contain the lifestyle photo strip');

assert.ok(has(indexHtml, /features\.html/), 'index.html should link to features.html');
assert.ok(has(indexHtml, /how-it-works\.html/), 'index.html should link to how-it-works.html');
assert.ok(has(featuresHtml, /Start Free Trial/), 'features.html should keep a start trial CTA');
assert.ok(has(howHtml, /Start Free Trial|Try It Free/), 'how-it-works.html should keep a start trial CTA');

console.log('Landing page split checks passed.');
