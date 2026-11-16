/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        //Color principal de la marca, los colores de cada segmento vienen de la API
        brand: {
          50: '#FFF1F7',
          100: '#FFE1EE',
          200: '#FFC3DD',
          300: '#FF94C2',
          400: '#FB5C9F',
          500: '#F0357F',
          600: '#DB1D69',
          700: '#B71255',
          800: '#931148',
          900: '#78123E',
        },
        //Color secundario naranja para los degradados
        coral: {
          300: '#FFB38A',
          400: '#FF9161',
          500: '#FF7340',
        },
        //Fondos claros de la interfaz
        surface: {
          bg: '#FCF9F8',
          card: '#FFFFFF',
          border: '#F1E6E9',
          subtle: '#F8F1F3',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '22px',
        '3xl': '28px',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(120, 18, 62, 0.04)',
        card: '0 1px 2px rgba(120, 18, 62, 0.04), 0 8px 24px -12px rgba(120, 18, 62, 0.12)',
        glow: '0 10px 30px -10px rgba(219, 29, 105, 0.55)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -20px) scale(1.08)' },
          '66%': { transform: 'translate(-20px, 15px) scale(0.95)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        blob: 'blob 14s ease-in-out infinite',
        'fade-up': 'fade-up 0.45s ease-out both',
      },
    },
  },
  plugins: [],
}
