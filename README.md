# ⚙️ HIDROMÁTICOS J.SAN, C.A. (Web Oficial v2 · UI Clara / Navy Blue & Corporate Blue)

Sitio web oficial de **HIDROMÁTICOS J.SAN, C.A.** (RIF: `J-40348320-5`) construido en **Astro 5 + TypeScript + Tailwind CSS v4**.

- **Identidad Visual:** Edición Clara / Institucional (Azul Marino Institucional `#0f2a57`, Azul Corporativo Real `#2D5893`, Dorado del Escudo `#c9a227`, Celeste `#eef4fb`, Blanco `#ffffff`).
- **Tipografías Self-hosted:** *Barlow* & *Barlow Condensed* (vía `@fontsource`).
- **Rendimiento:** 0 KB de JavaScript pesado en cliente, 100/100 Core Web Vitals, SSG nativo.
- **Despliegue:** Optimizado para Vercel Serverless / Static.

---

## 🧭 Estructura del Proyecto

```
webjsanv2/
├── public/
│   ├── assets/              # Logotipos oficiales y marcas USA
│   ├── robots.txt           # Directivas para motores de búsqueda
│   └── llms.txt             # Información estructurada para LLMs y motores IA
├── src/
│   ├── assets/marcas/       # SVGs de 16 fabricantes automotrices (embebidos en build)
│   ├── components/          # Componentes modulares y atómicos
│   │   ├── BrandsMarquee.astro
│   │   ├── FaqAccordion.astro
│   │   ├── FinalCta.astro
│   │   ├── Header.astro
│   │   ├── Hero.astro
│   │   ├── LocationsSection.astro
│   │   ├── MarcasUsa.astro
│   │   ├── ProcessCards.astro
│   │   ├── ReviewCarousel.astro
│   │   ├── ReviewsSection.astro
│   │   ├── ServicesSection.astro
│   │   ├── SiteFooter.astro
│   │   ├── Topbar.astro
│   │   └── WhatsAppFloat.astro
│   ├── content/blog/        # Artículos Markdown tipados con Astro 5 Content Collections
│   ├── content.config.ts    # Esquema Zod de validación para colecciones de contenido
│   ├── data/
│   │   └── site.ts          # ⭐ FUENTE ÚNICA DE VERDAD: teléfonos, RIF, sedes, redes, reseñas
│   ├── layouts/
│   │   └── BaseLayout.astro # Base HTML, SEO local (Caracas/Miranda), Open Graph y Schema JSON-LD
│   ├── pages/               # Rutas estáticas generadas
│   │   ├── index.astro      # Landing principal
│   │   ├── nosotros.astro   # Propósito, Misión, Visión (PMV) y valores
│   │   ├── contacto.astro   # Canales de atención directa y ubicación
│   │   ├── resenas.astro    # Muro de opiniones y reseñas Google Maps (★4.6)
│   │   ├── videos.astro     # Video destacado de YouTube (Lite Player) y Reels de Instagram
│   │   ├── terminos.astro   # Términos legales de servicio y garantías de 3 a 6 meses
│   │   ├── blog.astro       # Listado de guías mecánicas
│   │   └── blog/[...slug].astro # Vista de lectura individual
│   └── styles/
│       └── global.css       # Tailwind v4, tokens de diseño y utilidades
├── astro.config.mjs         # Configuración de Astro con sitemap y tailwind
├── ROADMAP_MIGRACION_ASTRO.md # Blueprint técnico maestro
└── tsconfig.json            # Configuración estricta de TypeScript
```

---

## 🛠️ Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor local de desarrollo
npm run dev

# Compilar para producción (SSG)
npm run build

# Previsualizar el build de producción
npm run preview

# Comprobación de tipos y diagnósticos Astro
npm run check
```

---

## 🛡️ Datos Oficiales del Negocio (`src/data/site.ts`)

- **Razón Social:** HIDROMÁTICOS J.SAN, C.A.
- **RIF:** J-40348320-5 (RIF Corto: J-40348320)
- **Sede:** Urb. Monte Cristo, 1ra con 3ra transversal, Calle 10 — Miranda, Caracas (Frente a Campi Ferretería).
- **Teléfonos:** (0212) 235.1931 · (0212) 237.7340
- **WhatsApp:** 0424-232.0424
- **Fundación:** 2013

---

## 🔎 Portal de Consulta (`/consulta/`)

Página **noindex** (fuera del sitemap) donde el cliente consulta el expediente de su vehículo con la placa: recepción con fotos, informe del scanner X431, estado de la orden (tracker), historial y señal de garantía. Sin datos personales ni montos.

- **Arquitectura:** Astro SSG + 2 funciones serverless **read-only** en `api/` (`expediente.js`, `x431.js`) con caché de borde (sin base de datos). El núcleo compartido vive en `api/_lib/` (no se expone como endpoint).
- **Endpoints:**
  - `GET /api/expediente?placa=AE473LM` → DTO del expediente (rate-limit 30 rpm/IP · `s-maxage=60` + SWR 600 s).
  - `GET /api/x431?doc=<id>&rt=<tipo>` → informe nativo del scanner (caché 24 h + SWR 7 días).
- **Variables de entorno** (Vercel, proyecto `webjsanv2`): `LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_BASE_TOKEN` en Production + Preview + Development.
- **Pruebas de runtime:** `tests/consulta-dom.mjs` ejecuta el bundle compilado en jsdom contra datos reales de la Base (requiere `jsdom` instalado aparte y las credenciales `LARK_*`; ver la cabecera del archivo).

### Nota operativa (si algo cambia)

| Si cambia… | Qué hacer |
|---|---|
| **Lark** (Base, tablas o campos) | Revisar los IDs en `TABLAS` (`api/_lib/expediente.js`) y la lista blanca de campos de `api/_lib/fanout.js`. Los campos nuevos **no** se exponen hasta agregarlos explícitamente. |
| **El link del X431** | Se detecta por patrón `usait.x431.com` en los textos del Diagnóstico (`extraerInformeX431`); si cambia el dominio, actualizar el patrón. |
| **Estados de la OT** | El mapeo a etapas vive en `etapaDeEstado()` (`api/_lib/fanout.js`). |
| **Fotos** | El bot solo firma las subidas **con el formulario** al crear el registro (ver `MEJORAS-PENDIENTES-LARK.md` §8 en el workspace `Jsan/Lark`). Las demás se avisan por WhatsApp. |
| **Caída de Lark o del X431** | El portal degrada con avisos y reintento; nunca deja la página en blanco. |

### Rendimiento y caché (menos llamadas a Lark)

- **Por consulta**: 5 búsquedas (una por tabla) + firma de fotos en lotes de 5 (en paralelo). El token se reutiliza ~2 h y las **firmas de fotos 20 h** en caché del proceso.
- **Medido en vivo**: 5,3 s en frío (9 llamadas) y **1,8 s en caliente (5 llamadas)**; consultas concurrentes de la misma placa se deduplican (3 simultáneas = 1 sola consulta a Lark).
- **Borde**: `s-maxage=120` + `stale-while-revalidate=900` (no encontrada 45/300); X431 24 h + SWR 7 días → cada placa golpea Lark como máximo ~1 vez cada 2 min.
- **Fotos**: `preconnect` al CDN de Lark, carga diferida de la visible ±1 y primera foto con `fetchpriority=high`. El navegador cachea por URL firmada.
- **Videos**: nunca se firman ni se exponen; solo se cuenta cuántos hay y se ofrecen por WhatsApp.
- **Sin refresco forzado**: la página muestra el sello «Actualizado hace X · se actualiza solo» y la frescura la gobierna la política de caché (activa ≤2,5 min · entregada ≤10 min). No hay botón que salte la caché: los clics no generan llamadas a Lark.
- **Si el tráfico crece**: proxy `GET /api/foto?t=<file_token>` con caché inmutable por token (URL estable entre visitas) o KV para compartir firmas entre instancias.

### Checklist post-merge (verificar en producción)

- [ ] La página `/consulta/` responde 200 y trae `<meta name="robots" content="noindex, follow">`.
- [ ] `/consulta/` **no** aparece en `https://hidromaticosjsan.com/sitemap-0.xml`.
- [ ] `GET /api/expediente?placa=AE473LM` responde 200 con el DTO real.
- [ ] Segunda llamada seguida: cabecera `x-vercel-cache: HIT`.
- [ ] Revisión en 360–430 px: buscador, tracker y carrusel operativos.
