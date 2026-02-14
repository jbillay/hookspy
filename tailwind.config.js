/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#0d9488',
          hover: '#14b8a6',
          light: '#ccfbf1',
          subtle: '#f0fdfa',
        },
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
