/**
 * Tailwind configuration - Smart Placement Management System
 *
 * The palette is deliberately restrained: a deep navy/indigo primary for
 * brand surfaces, a cool neutral ramp for the page chrome and a small set of
 * semantic accents (emerald / amber / rose / sky) that are only ever used to
 * communicate state.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* Primary - deep indigo used for actions and emphasis. */
        brand: {
          50: '#eef1ff',
          100: '#e0e5ff',
          200: '#c7cdfd',
          300: '#a4aefa',
          400: '#7c83f4',
          500: '#5c60e9',
          600: '#4748dc',
          700: '#3a39b8',
          800: '#303196',
          900: '#2b2d78',
          950: '#191a47',
        },
        /* Navy - the dark chrome of the application shell. */
        navy: {
          50: '#f5f7fb',
          100: '#e9edf6',
          200: '#cfd8ea',
          300: '#a7b5d2',
          400: '#7a8cb4',
          500: '#586b96',
          600: '#415279',
          700: '#33415f',
          800: '#252f47',
          900: '#161e33',
          950: '#0b1222',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.05)',
        'card-hover': '0 4px 6px -1px rgb(15 23 42 / 0.06), 0 10px 20px -6px rgb(15 23 42 / 0.10)',
        popover: '0 10px 15px -3px rgb(15 23 42 / 0.08), 0 24px 48px -12px rgb(15 23 42 / 0.16)',
        'focus-brand': '0 0 0 3px rgb(92 96 233 / 0.18)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'fade-in-up': 'fade-in-up 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 160ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
