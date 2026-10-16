/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#0E0F13',
        surface: '#15171E',
        'surface-card': '#15171E',
        'surface-elevated': '#1E212B',
        'surface-hover': '#282C38',
        'border-subdued': 'rgba(255, 255, 255, 0.06)',
        'border-active': 'rgba(124, 242, 200, 0.35)',
        'text-primary': '#EDEEF2',
        'text-secondary': '#A0A4B4',
        'text-muted': '#6B7080',
        'brand-mint': '#7CF2C8',
        'brand-pink': '#FF5FA2',
        'brand-gold': '#FFB84D',
        'brand-twitch': '#9146FF',
        'brand-purple': '#A855F7',
        'brand-emerald': '#10B981',
      },
      fontFamily: {
        sans: ['Manrope', 'Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

