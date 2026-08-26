import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Crono Corte — Estilo 3 Minimal
        // El color de acento es personalizable por barbería: estas variables CSS
        // se inyectan en runtime (ver accentColorVars en lib/utils). El valor por
        // defecto vive en globals.css (#e63946).
        brand: {
          red:         'rgb(var(--red) / <alpha-value>)',
          'red-dark':  'rgb(var(--red-dark) / <alpha-value>)',
          'red-light': 'rgb(var(--red-light) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
          'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out both',
        'fade-in-up': 'fadeInUp 0.4s ease-out both',
        'scale-in': 'scaleIn 0.25s ease-out both',
        'slide-up': 'slideUp 0.3s ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
