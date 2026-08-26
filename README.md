# 🧡 hidromaticos-web — Sitio oficial de Hidromáticos J-SAN, C.A.

Sitio estático en **Astro + Tailwind v4**, desplegado en Vercel → `https://hidromaticosjsan.com`
(dominio del cliente desde 2013, DNS en Cloudflare del cliente).

Diseño: industrial negro `#0a0a0b` + naranja `#ff5a00`, portado fielmente desde la v2
(`~/Desktop/jsan/jsan-v2`). Sin e-commerce por decisión del cliente.

## Estructura

```
src/
├── assets/marcas/     # SVGs de marcas automotrices (embebidos raw para currentColor)
├── assets/marcas-usa/ # Logos de fabricantes americanos de repuestos
├── components/        # Sidebar, Topbar, SiteFooter, WhatsAppFloat, ReviewCarousel, MarcasUsa, SocialGrid
├── content.config.ts  # ⭐ Astro 5 Content Layer (colección 'blog' con loader glob + Zod)
├── content/blog/      # Artículos Markdown tipados del blog
├── data/site.ts       # ⭐ FUENTE DE VERDAD: teléfonos, direcciones, RIF, nav, reseñas
├── layouts/BaseLayout # Head SEO + JSON-LD (AutoRepair/FAQ/Product) + nav móvil + WA float
├── pages/             # index, nosotros, resenas, contacto, videos, terminos, blog/[...slug]
└── styles/global.css  # Tokens + estilos globales del diseño industrial
public/
├── robots.txt         # Permite crawlers de búsqueda e IA (GEO/LLMs)
└── llms.txt           # Ficha estructurada legible por LLMs
```

## Comandos

| Comando | Acción |
|---|---|
| `npm install` | Instalar dependencias |
| `npm run dev` | Servidor local en `localhost:4321` |
| `npm run check` | Validación de tipos TypeScript y diagnósticos Astro |
| `npm run build` | Compilación estática de producción a `./dist/` |
| `npm run preview` | Previsualizar build de producción localmente |

## Reglas de trabajo (no negociables)

- **El agente NUNCA mergea ni pushea a main.** Solo ramas + PRs verificados con `npm run check` y `npm run build`.
- Ángel es quien mergea a `main`; Vercel auto-deployea.
- Identidad de commits: `AngelDelN <57774536+aikapenelope@users.noreply.github.com>`.
- Cambiar teléfonos/direcciones SOLO en `src/data/site.ts`.

## Estado del Proyecto (Roadmap)

- [x] **Fase 1:** Port Astro 5 + Tailwind v4 del diseño industrial v2 (`/`, `/nosotros/`, `/resenas/`, `/contacto/`, `/terminos/`).
- [x] **Fase 2:** Secciones interactivas de Servicios (acordeón) y Marcas (tiles 16 fabricantes) con schema `FAQPage` dinámico.
- [x] **Fase 3:** Video corporativo de YouTube + reels reales en `/videos/`, y Blog estructurado con Astro 5 Content Collections (`src/content/blog/`).
- [x] **Fase 4:** Testimonios reales de Google Maps (★4.6, 35 opiniones), schema `Product` + `AggregateRating` y CTA directo a reseñar.
- [x] **Fase 4.5 (DX & Blindaje):** Tipado estricto TypeScript (`astro/tsconfigs/strict`), `npm run check`, deduplicación de componentes (`ReviewCarousel.astro`, `.world-dots`), accesibilidad y single-source-of-truth.
- [ ] **Fase 5 (Pendiente de Infraestructura):** Agregar dominio `hidromaticosjsan.com` en el proyecto de Vercel y configurar los registros CNAME/A en el Cloudflare del cliente.
