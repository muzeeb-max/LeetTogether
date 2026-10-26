/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#09090B',
          surface: '#111113',
          card: '#17171B',
          border: 'rgba(255,255,255,0.07)',
          text: '#FAFAFA',
          muted: '#A1A1AA'
        },
        brand: {
          primary: '#7C5CFF', // LeetTogether violet
          success: '#2ECC71', // Success green
          warning: '#F59E0B', // Vibrant orange/yellow
          danger: '#EF4444'   // Red
        }
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
