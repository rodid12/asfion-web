# ASFION — Dashboard web

Dashboard analítico para visualizar datos de pariciones (y próximamente lluvias, mortandad, pastoreo y mediciones) cargados desde la app móvil de ASFION.

**v0.3** — multi-módulo: tabs para Pariciones, Lluvias, Mortandad y Pastoreo. Conectado a Supabase real, login con la misma cuenta que la app móvil; RLS filtra los datos por cliente automáticamente.

---

## Requisitos

- Node.js 18+
- npm 9+
- Acceso a un proyecto Supabase con el schema de ASFION cargado (ver `asfion-app/supabase/migrations/`).

## Setup

```bash
cd asfion-web
npm install
cp .env.local.example .env.local
# editar .env.local y completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

Abre http://localhost:5173 y logueate con un usuario de la tabla `usuarios` de Supabase.

## Build de producción

```bash
npm run build
npm run preview   # sirve el build para chequear
```

El output queda en `dist/` — se puede subir a Vercel, Netlify o cualquier CDN estático. En el host de prod hay que setear `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables de entorno antes del build.

---

## ¿Qué hay adentro?

```
src/
├── main.tsx                 # entry point (React root)
├── App.tsx                  # <AuthProvider> + Gate (Login | Dashboard)
├── index.css                # Tailwind + overrides de recharts
├── lib/
│   ├── supabase.ts          # cliente único (lee VITE_SUPABASE_*)
│   ├── auth.tsx             # AuthProvider + useAuth() hook
│   └── utils.ts             # cn(), formatNumber(), formatPercent()
├── data/
│   ├── types.ts             # mismas types que el mobile
│   ├── supabase.ts          # fetchCampos(), fetchPariciones() — solo reads
│   ├── useData.ts           # hook useDashboardData() con loading/error/refresh
│   ├── mock.ts              # data sintética (fallback para demo offline)
│   └── filters.ts           # modelo de filtros + aplicarFiltros()
├── components/
│   ├── Card.tsx
│   ├── Kpi.tsx
│   ├── FilterBar.tsx
│   └── ParicionesTable.tsx
├── charts/
│   ├── ParicionesMensuales.tsx
│   ├── DistribucionEventos.tsx
│   ├── ParicionesPorCampo.tsx
│   └── SexoYAsistencia.tsx
└── pages/
    ├── LoginPage.tsx        # login con supabase.auth.signInWithPassword
    ├── Dashboard.tsx        # shell: header + tabs + renderiza la page activa
    ├── ParicionesPage.tsx   # KPIs + 4 charts + tabla
    ├── LluviasPage.tsx      # KPIs + serie mensual + ranking por campo
    ├── MortandadPage.tsx    # KPIs + 4 charts (causa, categoría, campo, mes)
    └── PastoreoPage.tsx     # KPIs + por circuito + por categoría animal
```

## Tabs por módulo

El Dashboard es una "single page" con tabs en el header. La data se carga una sola vez al login (eager loading de los 4 módulos en paralelo), así cambiar de tab es instantáneo:

| Tab        | KPIs                                      | Charts principales                          |
|------------|-------------------------------------------|---------------------------------------------|
| Pariciones | Total, nacimientos, muertes+abortos, asistencia | Mensual, distribución, por campo, sexo |
| Lluvias    | mm acumulados, días con lluvia, máximo, campo top | Mensual, ranking por campo            |
| Mortandad  | Total, categoría top, causa top, campo top | Mensual, por causa, por categoría, por campo |
| Pastoreo   | Total movs, abiertos, circuitos activos, días promedio | Por circuito (total + abiertos), por categoría animal |

Cada tab tiene su propio `<SimpleFilterBar>` (rango + campo) — Pariciones mantiene el filtro adicional por evento.

---

## Auth

Wrappeado en `<AuthProvider>` (`src/lib/auth.tsx`). El SDK de Supabase persiste la sesión en `localStorage`, así que el usuario no se reloguea entre reloads.

`App.tsx` actúa como gate:

| Estado                    | Render            |
|---------------------------|-------------------|
| `loading=true` (boot)     | Splash mínimo     |
| Sin sesión                | `<LoginPage>`     |
| Con sesión                | `<Dashboard>`     |

Logout: botón en el header (icon `LogOutIcon`). `signOut()` limpia el localStorage y el gate vuelve a mostrar Login.

## Datos

Toda la lectura va por `src/data/supabase.ts`:

- `fetchCampos()` — `select * from campos order by nombre`.
- `fetchPariciones()` — `select * from pariciones order by fecha desc`.

RLS de Supabase filtra automáticamente por `cliente_id` (basado en el JWT). No hace falta pasar `cliente_id` en los queries.

El hook `useDashboardData()` (`src/data/useData.ts`) los ejecuta en paralelo y expone `{ data, loading, error, refresh }`. El botón circular del header dispara `refresh()`.

---

## Paleta ASFION (tailwind.config.js)

| Token                 | Hex       | Uso                                  |
|-----------------------|-----------|--------------------------------------|
| `asfion-deep`         | `#0F1F16` | header, botones primarios dark       |
| `asfion-dark`         | `#1B4332` | títulos, barras principales          |
| `asfion-lime`         | `#52B788` | acento, nacimientos positivos        |
| `asfion-terracota`    | `#C9823F` | alertas suaves, muertes              |
| `asfion-amber`        | `#B8802E` | sync pendiente                       |
| `asfion-danger`       | `#C9423F` | abortos, errores                     |
| `asfion-bg`           | `#F8F9F6` | fondo de página                      |
| `asfion-borderSoft`   | `#E2E8E0` | bordes, gridlines                    |
| `asfion-muted`        | `#6B7280` | texto secundario                     |

---

## Deploy a Vercel

El proyecto ya está configurado para deploy en Vercel (ver `vercel.json`).

### Primera vez

1. **Asegurate que `.env.local` no esté trackeado por git** (está en `.gitignore`, pero verificá con `git status` antes del primer commit).

2. **Inicializar repo y subir a GitHub**:
   ```bash
   cd asfion-web
   git init
   git add .
   git commit -m "Initial dashboard"
   # Crear repo vacío en github.com (sin README ni .gitignore)
   git remote add origin git@github.com:TU_USUARIO/asfion-web.git
   git branch -M main
   git push -u origin main
   ```

3. **Importar a Vercel**:
   - Entrar a https://vercel.com → Sign up / Log in con GitHub.
   - "Add New..." → "Project" → buscar el repo `asfion-web` → "Import".
   - Vercel detecta Vite automáticamente; no toques los presets.
   - Antes de "Deploy", expandir **Environment Variables** y agregar las dos:
     - `VITE_SUPABASE_URL` = `https://xxxxx.supabase.co`
     - `VITE_SUPABASE_ANON_KEY` = `eyJ...`
   - Click **Deploy** → ~2 min de build.

4. **Listo**. Vercel te da una URL del tipo `asfion-web-xxxx.vercel.app`. Compartila con quien necesite acceso (login con Supabase sigue siendo obligatorio).

### Updates posteriores

Cada `git push` a `main` re-deploya automáticamente. Pull requests crean un preview deploy con URL única.

### Dominio custom (opcional)

Vercel → tu proyecto → Settings → Domains → agregar `dashboard.asfion.com` (o el que sea). Vercel te da los DNS records para apuntar.

---

## Pendientes

- [x] ~~Export CSV real (botón ya está, falta wirear)~~.
- [ ] Drilldown: click en un campo filtra todo el dashboard por ese campo.
- [ ] Filtro por usuario (operario que cargó el evento).
- [ ] Modo "comparar período" (vs. mismo período del año anterior).
- [ ] Pluviómetro principal por campo (flag `es_principal` en DB).
