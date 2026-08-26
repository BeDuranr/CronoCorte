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
    },
  },
  plugins: [],
}

export default config
