/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        rubik: ['Rubik', 'sans-serif'],
      },
      colors: {
        cream: {
          50: '#FFFDF9',
          100: '#FFF8F0',
          200: '#F5E6D3',
          300: '#E8C9A8',
        },
        brown: {
          400: '#C9956C',
          500: '#A87048',
          600: '#8B5E3C',
          700: '#6B4226',
          800: '#3D2B1F',
        },
        tracker: {
          feeding: '#6B9E8C',
          vitaminD: '#E8B84B',
          diaper: '#9B8EC4',
          custom: '#E87B7B',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        soft: '0 2px 20px rgba(61, 43, 31, 0.08)',
        card: '0 4px 24px rgba(61, 43, 31, 0.10)',
        fab: '0 8px 32px rgba(139, 94, 60, 0.35)',
      },
    },
  },
  plugins: [],
}
