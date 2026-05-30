/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta ASFION (misma que el deck y la app)
        asfion: {
          deep:       '#0F1F16',
          dark:       '#1B4332',
          lime:       '#52B788',
          terracota:  '#C9823F',
          amber:      '#B8802E',
          bg:         '#F8F9F6',
          borderSoft: '#E2E8E0',
          muted:      '#6B7280',
          danger:     '#C9423F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 31, 22, 0.06), 0 1px 2px rgba(15, 31, 22, 0.04)',
      },
    },
  },
  plugins: [],
};
