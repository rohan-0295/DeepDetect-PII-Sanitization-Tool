/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Zinc is our base — warmer and more premium than slate/gray
        surface: '#18181b',   // zinc-900
        panel:   '#1c1c1f',   // between zinc-900 and zinc-800
        card:    '#27272a',   // zinc-800
        border:  '#3f3f46',   // zinc-700
        muted:   '#71717a',   // zinc-500
        subtle:  '#52525b',   // zinc-600
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
      },
    },
  },
  plugins: [],
};
