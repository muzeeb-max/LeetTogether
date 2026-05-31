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
          bg: '#0F172A',      // Primary dark background
          card: '#1E293B',    // Card/section background
          border: '#334155',  // Border colors
          text: '#F8FAFC',    // Light text on dark bg
          muted: '#94A3B8'    // Muted text
        },
        brand: {
          primary: '#3B82F6', // Vibrant blue
          success: '#22C55E', // Vibrant green
          warning: '#F59E0B', // Vibrant orange/yellow
          danger: '#EF4444'   // Red
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
