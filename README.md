# 🧡 hidromaticos-web — Sitio oficial de Hidromáticos J-SAN, C.A.

Sitio estático en **Astro + Tailwind v4**, desplegado en Vercel → `https://hidromaticosjsan.com`
(dominio del cliente desde 2013, DNS en Cloudflare del cliente).

Diseño: industrial negro `#0a0a0b` + naranja `#ff5a00`, portado fielmente desde la v2
(`~/Desktop/jsan/jsan-v2`). Sin e-commerce por decisión del cliente.

## Estructura

```
src/
├── assets/marcas/     # SVGs de logos (embebidos raw en build para currentColor)
├── components/        # Sidebar, Topbar, SiteFooter, WhatsAppFloat
├── data/site.ts       # ⭐ FUENTE DE VERDAD: teléfonos, direcciones, RIF, nav
├── layouts/BaseLayout # head SEO + JSON-LD AutoRepair + nav móvil + WA float
├── pages/             # index, nosotros, resenas, contacto (+ blog/videos/presentaciones Fase 3)
└── styles/global.css  # tokens + todo el CSS del diseño v2
public/
├── robots.txt         # permite crawlers de IA (GEO)
└── llms.txt           # ficha legible por LLMs
```

## Comandos

| Comando | Acción |
|---|---|
| `npm install` | instalar dependencias |
| `npm run dev` | servidor local en localhost:4321 |
| `npm run build` | build de producción a `./dist/` |

## Reglas de trabajo (no negociables)

- **El agente NUNCA mergea ni pushea a main.** Solo ramas + PRs verificados con `npm run build`.
- Ángel es quien mergea main; Vercel auto-deployea.
- Identidad de commits: `AngelDelN <57774536+aikapenelope@users.noreply.github.com>` (ya configurada).
  Otro email = Vercel bloquea el deploy.
- Cambiar teléfonos/direcciones SOLO en `src/data/site.ts`.

## Pendientes (roadmap)

- [ ] Fase 2: páginas `/servicios/` y `/marcas/` + FAQPage schema
- [ ] Fase 3: `/blog/` (Content Collections), `/videos/` y `/presentaciones/` (embeds YouTube/Drive)
- [ ] Fase 4: placeid de Google Business → botón writereview + reseñas vía Places API (`src/pages/resenas.astro`)
- [ ] Fase 5: dominio en Vercel + récords DNS al Cloudflare del cliente
