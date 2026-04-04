import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-space)', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── Cream & Warm palette ──
        cream: {
          50: '#fefdfb',
          100: '#faf8f4',  // fond principal
          200: '#f5f0e8',  // barres de progression bg
          300: '#f0ebe0',  // bordures
          400: '#e0d8c8',
          500: '#c4b99a',  // placeholder
        },
        navy: {
          DEFAULT: '#1a1a2e',
          50: '#f0f0f5',
          100: '#e0e0ea',
          200: '#c1c1d5',
          300: '#9393b0',
          400: '#65658a',
          500: '#3d3d5c',
          600: '#2a2a45',
          700: '#1a1a2e',  // couleur principale
          800: '#12122a',
          900: '#0a0a1a',
        },
        amber: {
          DEFAULT: '#fbbf24',
          50: '#fffbeb',   // fond tip/highlight
          100: '#fef3c7',
          200: '#fde68a',  // bordure tip
          300: '#fcd34d',
          400: '#fbbf24',  // accent principal
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',  // texte sur fond amber
          900: '#78350f',
        },
        warm: {
          muted: '#a0937c',   // texte secondaire
          border: '#f0ebe0',  // bordures cartes
          bg: '#faf8f4',      // fond page
          card: '#ffffff',    // fond carte
        },
        // Ancien primary conservé pour compatibilité axeHelpers
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.06)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.08)',
        'warm': '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.06)',
        'warm-hover': '0 4px 12px rgba(0, 0, 0, 0.06), 0 12px 40px rgba(0, 0, 0, 0.08)',
        'warm-glow': '0 4px 20px rgba(251, 191, 36, 0.3)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 6px 24px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06), 0 12px 40px rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.375rem',  // 22px — radius carte
        '4xl': '1.75rem',   // 28px — radius header
      },
      animation: {
        'slide-in': 'slide-in 0.22s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  safelist: [
    // Classes dynamiques utilisées dans axeHelpers.ts (getDynamique)
    'text-violet-700', 'bg-violet-100', 'border-violet-300',
    'text-sky-800', 'bg-sky-100', 'border-sky-300',
    'text-emerald-800', 'bg-emerald-100', 'border-emerald-300',
    'text-orange-800', 'bg-orange-100', 'border-orange-300',
    'text-rose-800', 'bg-rose-100', 'border-rose-300',
    // Cream & Warm palette
    'bg-cream-100', 'bg-navy', 'bg-amber-400', 'text-navy', 'text-amber-800',
    'border-warm-border', 'bg-warm-card', 'text-warm-muted',
  ],
  plugins: [],
}

export default config
