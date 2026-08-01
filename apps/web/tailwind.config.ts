import type { Config } from 'tailwindcss';

// Design language — Part 10. Restrained executive palette: navy + professional
// blue, a single warm gold accent, plentiful white/neutral, non-decorative
// status colors. The brief: familiar (M365-rooted) but not dated — refined
// depth, glass surfaces, and motion carry the "premium/contemporary" feeling
// instead of novelty color or shape. Deliberately not the generic
// purple-to-blue-gradient / Inter-everywhere AI-build look (10.2).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f4f6fa',
          100: '#e6eaf3',
          200: '#c7d1e4',
          300: '#9daecb',
          400: '#6c82ac',
          500: '#4a6088',
          600: '#354a6d',
          700: '#263757',
          800: '#1a2740',
          900: '#0f1f3d',
          950: '#0a1529',
          975: '#060e1d',
        },
        gold: {
          50: '#faf6ee',
          100: '#f1e7d0',
          200: '#e2cea1',
          300: '#cfae70',
          400: '#b08d57',
          500: '#997a49',
          600: '#7d633b',
          700: '#614d2f',
        },
        ink: '#1c2430',
        paper: '#fbfaf8',
        success: '#2f6d4f',
        'success-bg': '#eaf3ee',
        danger: '#a3352f',
        'danger-bg': '#faece9',
        warn: '#8a6414',
        'warn-bg': '#faf3e2',
      },
      fontFamily: {
        // A Microsoft/Office-familiar type feeling (10.3) rather than the
        // generic startup sans. Both are system fonts — no webfont loading,
        // and they render identically on the Windows machines this product's
        // primary users are on.
        sans: ['"Segoe UI"', '"Segoe UI Variable"', 'Calibri', 'system-ui', 'sans-serif'],
        serif: ['Cambria', 'Georgia', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
        card: '0 1px 2px rgba(15, 31, 61, 0.04), 0 1px 8px rgba(15, 31, 61, 0.05)',
        'card-hover': '0 8px 28px -6px rgba(15, 31, 61, 0.16), 0 2px 8px -2px rgba(15, 31, 61, 0.08)',
        popover: '0 12px 40px -8px rgba(10, 21, 41, 0.28), 0 4px 14px -4px rgba(10, 21, 41, 0.14)',
        glow: '0 0 0 1px rgba(176, 141, 87, 0.25), 0 4px 20px -2px rgba(176, 141, 87, 0.35)',
        'glow-navy': '0 0 0 1px rgba(15, 31, 61, 0.06), 0 8px 30px -6px rgba(15, 31, 61, 0.25)',
        'inner-line': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '22px',
      },
      backgroundImage: {
        'aurora-navy':
          'radial-gradient(60% 50% at 15% 10%, rgba(176,141,87,0.16) 0%, rgba(176,141,87,0) 60%), radial-gradient(55% 45% at 85% 20%, rgba(74,96,136,0.35) 0%, rgba(74,96,136,0) 60%), radial-gradient(70% 60% at 50% 100%, rgba(38,55,87,0.5) 0%, rgba(6,14,29,0) 60%)',
        'sheen': 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.5) 45%, rgba(255,255,255,0.5) 55%, transparent 80%)',
        'grid-lines':
          'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'aurora-drift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -2%, 0) scale(1.05)' },
        },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(176,141,87,0.35)' },
          '100%': { boxShadow: '0 0 0 8px rgba(176,141,87,0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        aurora: 'aurora-drift 14s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
