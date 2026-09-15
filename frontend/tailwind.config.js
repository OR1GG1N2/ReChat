/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#08090D',
        surface: '#0F111A',
        'surface-elevated': '#161926',
        'surface-hover': '#1C2030',
        'border-subdued': 'rgba(255, 255, 255, 0.07)',
        'border-active': 'rgba(168, 85, 247, 0.35)',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
        'brand-twitch': '#9146FF',
        'brand-purple': '#A855F7',
        'brand-emerald': '#10B981',
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

