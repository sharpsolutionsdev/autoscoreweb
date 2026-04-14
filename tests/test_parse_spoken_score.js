// Simple Node test harness for parseSpokenScore
// Mirrors logic from web-app.html (parseUnder100 + parseSpokenScore)

const _ONES = {
    'zero': 0, 'oh': 0, 'one': 1, 'won': 1, 'two': 2, 'too': 2, 'to': 2,
    'three': 3, 'free': 3, 'four': 4, 'for': 4, 'five': 5, 'six': 6,
    'seven': 7, 'eight': 8, 'ate': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
    'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19
};
const _TENS = {
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
};

function parseUnder100(t) {
    if (_ONES[t] !== undefined) return _ONES[t];
    if (_TENS[t] !== undefined) return _TENS[t];
    const w = t.split(' ');
    if (w.length === 2 && _TENS[w[0]] !== undefined && _ONES[w[1]] !== undefined) {
        return _TENS[w[0]] + _ONES[w[1]];
    }
    const h = t.split('-');
    if (h.length === 2 && _TENS[h[0]] !== undefined && _ONES[h[1]] !== undefined) {
        return _TENS[h[0]] + _ONES[h[1]];
    }
    const v = parseInt(t);
    return (!isNaN(v) && v >= 0 && v <= 180) ? v : null;
}

function parseSpokenScore(text) {
    text = String(text || '').toLowerCase()
        .replace(/\band\b/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/-/g, ' ')
        .trim();

    let multiplier = 1;
    const multMatch = text.match(/^(single|s|double|d|triple|treble|t)\s+(.+)$/);
    if (multMatch) {
        const key = multMatch[1];
        text = multMatch[2].trim();
        if (/^single$|^s$/.test(key)) multiplier = 1;
        else if (/^double$|^d$/.test(key)) multiplier = 2;
        else if (/^triple$|^treble$|^t$/.test(key)) multiplier = 3;
    }

    const shorthand = text.match(/^([tds])\s*([0-9]{1,3})$/);
    if (shorthand) {
        const s = shorthand[1];
        const n = parseInt(shorthand[2], 10);
        const m = s === 't' ? 3 : s === 'd' ? 2 : 1;
        const val = n * m;
        return (val >= 0 && val <= 180) ? val : null;
    }

    if (['bull', 'bullseye', 'bulls eye', 'bull eye'].includes(text)) return 50;
    if (['outer bull', 'outer', 'twenty five', 'twenty five'].includes(text)) return 25;
    if (['miss', 'missed', 'nothing', 'zero', 'none', 'bounce', 'bounce out'].includes(text)) return 0;

    if (text.startsWith('one hundred') || text.startsWith('a hundred')) {
        const rest = text.replace(/^(one hundred|a hundred)/, '').trim();
        if (!rest) return 100;
        const sub = parseUnder100(rest);
        if (sub !== null && (100 + sub) <= 180) return 100 + sub;
    }

    text = text.replace(/^score\s+/, '');

    const base = parseUnder100(text);
    if (base === null) return null;
    if (base === 50) return 50;
    const result = base * multiplier;
    return (result >= 0 && result <= 180) ? result : null;
}

// Test cases
const tests = [
    ['triple twenty', 60],
    ['treble twenty', 60],
    ['double twenty', 40],
    ['t20', 60],
    ['d25', 50],
    ['s20', 20],
    ['single twenty', 20],
    ['bull', 50],
    ['outer bull', 25],
    ['miss', 0],
    ['one hundred twenty', 120],
    ['score sixty', 60],
    ['twenty five', 25],
    ['twenty-five', 25],
    ['seventy two', 72],
    ['triple nineteen', 57],
    ['banana', null],
    ['', null]
];

let failures = 0;
tests.forEach(([input, expected], i) => {
    const got = parseSpokenScore(input);
    const pass = (got === expected) || (Number.isNaN(got) && Number.isNaN(expected));
    if (!pass) {
        failures++;
        console.error(`FAIL ${i + 1}: "${input}" → expected ${expected}, got ${got}`);
    } else {
        console.log(`ok ${i + 1}: "${input}" → ${got}`);
    }
});

if (failures > 0) {
    console.error(`\n${failures} test(s) failed.`);
    process.exit(1);
} else {
    console.log('\nAll tests passed.');
    process.exit(0);
}
