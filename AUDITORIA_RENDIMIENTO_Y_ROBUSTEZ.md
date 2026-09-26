# Auditoría de rendimiento y robustez — webjsanv2

Fecha: 26 de septiembre de 2026
Alcance: todo el repositorio (`src/`, `public/`, configuración Astro/Vercel, CMS Sanity).

---

## 1. Resumen ejecutivo

| Hallazgo | Severidad | Estado |
| :--- | :--- | :--- |
| El iframe del formulario de Lark bloqueaba el evento `load` de `/recepcion/` (4–5 s en móvil) | Alta | **Corregido** |
| `/recepcion/` descargaba ~6 MB / 73 peticiones, de los cuales **5.9 MB eran de Lark** | Alta | **Corregido** |
| `/videos/` cargaba 8 iframes (7 reels de Instagram + YouTube) al abrir la página | Alta | **Corregido** |
| El spinner desaparecía a los 4 s aunque el formulario siguiera cargando (dejaba un hueco blanco sin salida) | Media | **Corregido** |
| Los iframes se registraban **dos veces** (llamada directa + `astro:page-load`) en 5 componentes | Media | **Corregido** |
| 16 SVG de marcas repetidos dos veces en el HTML de la portada (~22 KB) | Media | **Corregido** |
| `site.webmanifest` declaraba tamaños de icono falsos (180×180 como 192 y 512) | Baja | **Corregido** |
| Sin cabecera `Content-Security-Policy` (solo `X-Frame-Options`) | Media | Recomendado |
| Barlow/Barlow Condensed 500 se descargan (2 × 22 KB) con uso marginal | Baja | Recomendado |
| `public/assets` incluye 2.2 MB de PNG no referenciados (`logo-jsan-original.png`, `logo-jsan.png`) | Baja | Recomendado |

Sin errores de tipos (`astro check`: 0 errores, 0 avisos) ni fallos de build.

---

## 2. Causa raíz del problema de "Recepción"

El formulario vive en Lark Base (`clarkuseqtlegfgv.usttp.larksuite.com`) y estaba incrustado
como `<iframe src=…>` en el HTML inicial. Consecuencias medidas con Chrome real
(viewport iPhone 390×844, red simulada 4G Venezuela: 1.6 Mbps y 150 ms, CPU ×4):

| Métrica en `/recepcion/` | Antes | Después | Mejora |
| :--- | ---: | ---: | ---: |
| Peticiones totales | 73 | 19 | **−74 %** |
| Peso total | 6 186 KB | 377 KB | **−94 %** |
| Peso de terceros | 5 888 KB | 0 KB | **−100 %** |
| Evento `load` | 4 963 ms | 2 128 ms | **−57 %** |
| FCP / LCP | 1 060 ms | 1 092 ms | igual |

El detalle importante: el `load` de la página **esperaba a Lark** (5 888 KB repartidos entre
`lf-lark-static-usttp.larksuitecdn.com`, `larksuite.com` y su API interna). En iOS/Android eso
se ve como una barra de carga que nunca termina, aunque el HTML propio ya estuviera pintado
en ~1 s. Ese era el "tarda muchísimo" que reportaba el taller.

---

## 3. Qué se implementó

### 3.1 Patrón *facade* reutilizable (`src/lib/lazyEmbed.ts`)

Módulo único (≈5 KB) que gobierna cualquier embed de terceros mediante atributos `data-*`:

* **Idle**: solo se pinta la fachada (0 KB de terceros, sin tocar la red).
* **Precalentamiento**: `dns-prefetch` + `preconnect` **solo** ante intención real
  (`pointerenter`, `touchstart`, `focusin`), de modo que el clic posterior sea instantáneo.
* **Carga**: el iframe se inyecta con los mismos atributos que tenía antes
  (`sandbox`, `allow`, `allowfullscreen`, clase y alto), se muestra un spinner honesto hasta
  el evento `load` real.
* **Auto-carga segura** (`data-auto="desktop"`): únicamente en pantallas ≥ 1024 px, sin
  `saveData`, sin 2G, cuando la tarjeta entra en el viewport y en tiempo ocioso
  (`requestIdleCallback`).
* **Timeout con salida**: si el embed no responde (20 s en Lark, 12 s en mapas/reels) se
  libera el iframe y se ofrece reintentar, abrir en pestaña nueva o WhatsApp. Nunca un
  hueco en blanco sin alternativa.
* **Idempotente** y consciente de `ClientRouter` (ignora nodos desconectados para no gastar
  red si la página ya cambió).

Aplicado a: formulario de Lark (`RecepcionSection`), mapa de Google (`LocationsSection`) y
reels de Instagram (`videos.astro`).

### 3.2 Móvil primero en la recepción

En pantallas < 1024 px, el botón destacado pasa a ser **"Abrir formulario en pantalla
completa"** y "Llenar la planilla aquí mismo" queda como opción secundaria (se intercambian
por CSS, sin JS y sin quitar ninguna opción). Es la ruta más fiable en celular: Lark abre
mejor como documento propio que dentro de un iframe de terceros.

### 3.3 Otros arreglos

* Sprite único de escudos (`<symbol>` + `<use>`) en `BrandsMarquee`: los 16 SVG se emiten una
  vez en lugar de dos.
* Guardas de idempotencia en `Header`, `SymptomSelector`, `videos` y `resenas`
  (el patrón correcto ya existía en `ServicesSection`).
* Iconos reales 192×192 y 512×512 generados desde el logo (`icon-192.png`, `icon-512.png`,
  9 KB y 46 KB) y manifest corregido.
* `:global()` en las reglas CSS de los iframes inyectados por JS (si no, Astro les exige el
  atributo `data-astro-cid` que nunca reciben y pierden alto y estilos).

---

## 4. Verificación ejecutada

* `npx astro check`: 0 errores / 0 avisos.
* `npm run build`: 12 páginas, sin iframes en el HTML servido (portada, recepción y videos).
* **31 pruebas funcionales en Chrome headless** (viewport móvil y escritorio) todas en verde:
  fachada visible, cero peticiones a terceros antes del clic, iframe inyectado con `sandbox` y
  `allow` idénticos, alturas sin salto de layout, spinner y estado de error, auto-carga en
  escritorio, navegación SPA con `ClientRouter`, mapa y reels bajo demanda.
* Capturas revisadas de carrusel de marcas, fachada de recepción, fachada del mapa y reels.

---

## 5. Cómo usar el patrón en un embed nuevo

```astro
<div
  data-lazy-embed
  data-src="https://servicio-externo.com/embed"
  data-auto="none"                <!-- "desktop" para auto-carga solo en PC -->
  data-timeout-ms="12000"
  data-frame-class="mi-iframe"
  data-frame-title="Descripción accesible"
  data-frame-allow="fullscreen"
  data-frame-allow-fullscreen="true"
  data-frame-sandbox="allow-scripts allow-same-origin"  <!-- solo si hace falta -->
>
  <div data-lazy-embed-facade>      <!-- se ve primero, sin red -->
    <button type="button" data-lazy-embed-load>Cargar</button>
  </div>
  <div data-lazy-embed-loading role="status" aria-live="polite" hidden>…</div>
  <div data-lazy-embed-error role="alert" hidden>
    <button type="button" data-lazy-embed-retry>Reintentar</button>
  </div>
  <div data-lazy-embed-slot hidden></div>
</div>
```

```astro
<script>
  import { setupLazyEmbeds } from '../lib/lazyEmbed';
  setupLazyEmbeds();
  document.addEventListener('astro:page-load', setupLazyEmbeds);
</script>
```

Reglas de oro:

1. El CSS del iframe inyectado debe ir con `:global(...)`.
2. Los overlays usan `hidden`; hay que declarar `selector[hidden] { display: none; }` porque las
   reglas de autor con `display: flex` anulan el valor por defecto del navegador.
3. El contenedor debe reservar el alto final (`min-height`, `aspect-ratio`) para que la carga
   no mueva el layout.

---

## 6. Recomendaciones pendientes (por orden de impacto)

1. **Cabecera `Content-Security-Policy`** en `vercel.json`. Hoy no hay CSP: el sitio confía en
   cualquier script. Propuesta mínima (probar primero en `Content-Security-Policy-Report-Only`):

   ```
   default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';
   script-src 'self' 'unsafe-inline' https://clarkuseqtlegfgv.usttp.larksuite.com;
   frame-src https://clarkuseqtlegfgv.usttp.larksuite.com https://www.google.com
             https://www.instagram.com https://www.youtube-nocookie.com;
   font-src 'self'; connect-src 'self' https://*.sanity.io; base-uri 'self';
   form-action 'self' https://*.larksuite.com; frame-ancestors 'self'
   ```

2. **Peso de fuentes: 155 KB** (7 woff2) en cada visita. Los pesos 500 de Barlow y
   Barlow Condensed se usan en 3 lugares con `font-weight: 500`. Si se retiran los `@import`
   de `@fontsource/barlow/500.css` y `barlow-condensed/500.css` (o se cambian esos 3 usos a 400/600)
   se ahorran ~44 KB en móvil. Requiere revisión visual.

3. **Logo de 76 KB** (`logo-jsan.webp`, 720×668). Ya está codificado a ~calidad 88; bajar a
   calidad 82 son 61 KB (−19 %) y a 480×445 calidad 90 son 42 KB (−45 %). Solo si el taller
   acepta una leve pérdida de nitidez en retina.

4. **Limpiar `public/assets`**: `logo-jsan-original.png` (1.6 MB) y `logo-jsan.png` (531 KB)
   no están referenciados en el código. No pesan en la visita (no se descargan) pero inflan el
   despliegue; conviene moverlos a una carpeta de origen fuera de `public/`.

5. **`/assets/*` con `Cache-Control: immutable` (1 año)**: si algún día se reemplaza el logo o
   un icono con el mismo nombre, los visitantes seguirán viendo el antiguo. Renombrar el
   archivo en cada cambio o servir esos archivos con `max-age=86400`.

6. **Medición continua**: ejecutar Lighthouse/PageSpeed sobre `/recepcion/` y `/videos/` tras
   cada despliegue.

