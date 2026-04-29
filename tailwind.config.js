/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#e8edff',
          500: '#5b6bff',
          600: '#4855e6',
          700: '#3a45b8',
        },
      },
    },
  },
  plugins: [],
};
