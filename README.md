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
