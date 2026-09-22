/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tata: {
          bg: '#f8fafc',        // Pure clean light background
          surface: '#ffffff',   // Card background
          elevated: '#f1f5f9',  // Hover background
          border: '#e2e8f0',    // Border color
          navy: '#001035',      // Deep Tata Navy
          magenta: '#e20d65',   // Tata Play Fiber Magenta
          'magenta-dark': '#b3004b',
          'magenta-light': '#ff2a83',
          cyan: '#0099ff',      // Fiber cyan accent
          blue: '#1d4ed8',
          purple: '#6d28d9',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'tata-card': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'magenta-glow': '0 0 20px -3px rgba(226, 13, 101, 0.35)',
      }
    },
  },
  plugins: [],
}
