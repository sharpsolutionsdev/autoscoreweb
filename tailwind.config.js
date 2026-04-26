/**
 * Canonical Tailwind config for DartVoice production build.
 * Replaces every inline `tailwind.config = {…}` block that previously
 * sat alongside the CDN runtime. Output:  css/tailwind.built.css
 */
module.exports = {
  content: [
    './*.html',
    './prototypes/**/*.html',
    './emails/**/*.html',
    './components/**/*.{js,html}',
    './*.js',
  ],
  // Safelist a few classes that are emitted from JS template literals or
  // dynamic class strings, which the JIT scanner sometimes misses.
  safelist: [
    'tier-bronze', 'tier-silver', 'tier-gold', 'tier-platinum',
    'tier-diamond', 'tier-apex', 'tier-champion', 'tier-unranked',
    'dv-is-ambassador', 'dv-is-creator', 'dv-is-admin', 'dv-can-overlay',
    'hidden', 'active',
    { pattern: /^(bg|text|border)-(brand|brand-light|dark|card|card-2|card2|wire|muted|muted-2|muted2|chalk|success)\b/ },
  ],
  theme: {
    extend: {
      screens: {
        xs: '475px',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'sans-serif'],
        sans:    ['"Plus Jakarta Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand:         'var(--brand, #CC0B20)',
        'brand-light': 'var(--brand-light, #e60d24)',
        dark:          '#08080A',
        'dark-2':      '#0f0f0f',
        card:          '#111114',
        'card-2':      '#18181C',
        // Some pages use the un-hyphenated name. Alias so both work.
        card2:         '#18181C',
        wire:          '#252530',
        muted:         '#6E6E82',
        'muted-2':     '#4A4A5A',
        muted2:        '#4A4A5A',
        chalk:         '#F0F0F5',
        success:       '#22c55e',
      },
    },
  },
  plugins: [],
};
