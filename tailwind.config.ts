import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette Valcausse — extraite du logo et du site officiel
        cream: '#f7f5f0',

        // Brun-bordeaux principal (texte "VALCAUSSE" dans le logo)
        brun: {
          50:  '#fdf5f3',
          100: '#f9e6e2',
          200: '#f0c4bc',
          300: '#e49589',
          400: '#d0604f',
          500: '#9b3a2c',
          600: '#7B2820',  // couleur exacte du logo
          700: '#641f19',
          800: '#511811',
          900: '#3d1009',
        },

        // Orange/or (carré avec l'épi dans le logo)
        or: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#f9c84a',
          400: '#e8a81e',
          500: '#C8941A',  // couleur exacte du logo
          600: '#a37514',
          700: '#7d590f',
          800: '#5a400a',
          900: '#3a2906',
        },

        // Bleu accent (boutons/liens du site)
        bleu: {
          50:  '#eff6fb',
          100: '#d9ecf5',
          200: '#a8d2e8',
          300: '#72b4d7',
          400: '#5a9ec8',
          500: '#448ab5',  // couleur principale du site
          600: '#366e90',  // hover du site
          700: '#2a5570',
          800: '#1e3d51',
          900: '#122432',
        },

        // Vert succès (conservé pour les statuts positifs)
        vert: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },

        // Orange alerte
        alerte: {
          50:  '#fff7ed',
          100: '#ffedd5',
          500: '#f59b00',  // orange du site
          600: '#c47a00',
          700: '#9a5f00',
        },

        rouge: {
          50:  '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        // Police officielle du site Valcausse
        sans: ['"Open Sans"', 'Arial', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
