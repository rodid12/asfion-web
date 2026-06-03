/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta ASFION — derivada del logo oficial (naranja + navy).
        // Cambia un valor acá y se actualiza todo el dashboard.
        asfion: {
          // Brand — orange fiel al SVG (#FF8409), navy softeneado para UI.
          navyDeep:   '#0F2535',
          navy:       '#163349',
          orange:     '#FF8409',
          orangeSoft: '#FFCB95',
          // Variante un toque más saturada del peach, solo para uso sobre
          // bg navy (tiles del Home en la app). Disponible acá por si la
          // usamos en alguna sección dark del dashboard.
          orangeTile: '#FFB97A',
          // Status
          success:    '#3FAE5A',
          danger:     '#C9423F',
          amber:      '#D89425',
          terracota:  '#C9823F',
          // Neutrales
          bg:         '#F7F5F1',
          borderSoft: '#E5E2DD',
          muted:      '#6B7280',
          dark:       '#1A1A1A', // text dark
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(30, 46, 63, 0.06), 0 1px 2px rgba(30, 46, 63, 0.04)',
      },
    },
  },
  plugins: [],
};
