import type { Config } from 'tailwindcss';

// Design language — Part 10. Restrained executive palette: navy + professional
// blue, a single warm gold accent used sparingly, plentiful white/neutral,
// and non-decorative status colors. Deliberately not the generic
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
        card: '0 1px 2px rgba(15, 31, 61, 0.06), 0 1px 8px rgba(15, 31, 61, 0.06)',
        popover: '0 4px 24px rgba(15, 31, 61, 0.14)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
    },
  },
  plugins: [],
};

export default config;
