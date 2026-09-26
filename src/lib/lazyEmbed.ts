/**
 * lazyEmbed — Carga diferida y robusta de iframes de terceros.
 *
 * PROBLEMA QUE RESUELVE
 * Un iframe de terceros pesado (formulario de Lark Base, mapa de Google) entra en
 * el evento `load` de la página principal. Mientras ese embed no termina de
 * descargar, el navegador mantiene la página en estado "cargando" y en móvil se
 * percibe como si el sitio tardara muchísimo en abrir.
 *
 * ESTRATEGIA (facade / fachada)
 *  1. La primera pintura renderiza solo el HTML propio: cero red de terceros.
 *  2. El iframe se inyecta cuando el usuario lo pide (clic/tap) o cuando es
 *     seguro hacerlo solo: pantalla grande, conexión no lenta y ya inactivo.
 *  3. El estado de carga es honesto: spinner hasta el `load` real del iframe,
 *     timeout con reintento y salidas de emergencia (enlace externo / WhatsApp).
 *  4. Precalentamiento (DNS + TLS) solo ante intención del usuario, para que el
 *     clic posterior se sienta instantáneo sin gastar datos en vano.
 *
 * USO (marcado declarativo)
 *   <div data-lazy-embed data-src="https://…" data-auto="desktop"
 *        data-frame-class="recepcion-iframe" data-frame-title="…"
 *        data-frame-allow="camera; geolocation" data-frame-sandbox="allow-scripts …">
 *     <div data-lazy-embed-facade> … botón con [data-lazy-embed-load] … </div>
 *     <div data-lazy-embed-loading hidden> … </div>
 *     <div data-lazy-embed-error hidden> … botón con [data-lazy-embed-retry] … </div>
 *     <div data-lazy-embed-slot></div>
 *   </div>
 *
 * El módulo es idempotente: puede llamarse en la carga inicial y en cada
 * navegación de ClientRouter (`astro:page-load`) sin duplicar listeners.
 */

type EmbedState = 'idle' | 'loading' | 'loaded' | 'failed';

const MIN_DESKTOP_WIDTH = 1024;
const DEFAULT_TIMEOUT_MS = 15000;
const WARM_EVENTS = ['pointerenter', 'touchstart', 'focusin'] as const;

function first<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

function setHidden(el: Element | null, hidden: boolean): void {
  if (!el) return;
  if (hidden) el.setAttribute('hidden', '');
  else el.removeAttribute('hidden');
}

/** ¿La conexión del usuario desaconseja cargar un embed pesado por su cuenta? */
function connectionIsConstrained(): boolean {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (!connection) return false;
  if (connection.saveData === true) return true;
  return /(^|-)2g$/.test(connection.effectiveType ?? '');
}

/** preconnect + dns-prefetch diferidos: solo cuando hay intención de uso. */
function warmUp(url: string): void {
  let origin: string;
  try {
    origin = new URL(url, window.location.href).origin;
  } catch {
    return;
  }
  if (document.head.querySelector(`link[data-embed-warm="${origin}"]`)) return;

  const dns = document.createElement('link');
  dns.rel = 'dns-prefetch';
  dns.href = origin;
  dns.setAttribute('data-embed-warm', origin);

  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = origin;
  preconnect.setAttribute('data-embed-warm', origin);

  document.head.append(dns, preconnect);
}

function scheduleIdle(task: () => void): void {
  const idle = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof idle === 'function') idle(task, { timeout: 2500 });
  else window.setTimeout(task, 300);
}

function setupLazyEmbed(root: HTMLElement): void {
  if (root.dataset.lazyEmbedReady === '1') return;
  root.dataset.lazyEmbedReady = '1';

  const src = root.dataset.src;
  const slot = first<HTMLElement>(root, '[data-lazy-embed-slot]');
  if (!src || !slot) return;

  const facade = first<HTMLElement>(root, '[data-lazy-embed-facade]');
  const loading = first<HTMLElement>(root, '[data-lazy-embed-loading]');
  const error = first<HTMLElement>(root, '[data-lazy-embed-error]');
  const timeoutMs = Number(root.dataset.timeoutMs) || DEFAULT_TIMEOUT_MS;

  let iframe: HTMLIFrameElement | null = null;
  let timeoutId: number | undefined;
  let state: EmbedState = 'idle';
  let warmedUp = false;

  const paint = (next: EmbedState) => {
    state = next;
    root.dataset.lazyEmbedState = next;
    setHidden(facade, next !== 'idle');
    setHidden(loading, next !== 'loading');
    setHidden(error, next !== 'failed');
    slot.hidden = next === 'idle' || next === 'failed';
  };

  const stopTimeout = () => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  /** Libera el iframe fallido: no dejamos un contenedor en blanco "zombi". */
  const teardown = () => {
    stopTimeout();
    if (iframe) {
      iframe.removeAttribute('src');
      iframe.remove();
      iframe = null;
    }
    slot.replaceChildren();
  };

  const fail = () => {
    if (!root.isConnected) return;
    teardown();
    paint('failed');
  };

  const succeed = () => {
    stopTimeout();
    if (!root.isConnected) return;
    paint('loaded');
  };

  const load = () => {
    // Si ClientRouter ya cambió de página, el nodo está desconectado: no gastamos red
    if (!root.isConnected) return;
    if (state === 'loading' || state === 'loaded') return;
    paint('loading');

    const frame = document.createElement('iframe');
    frame.className = root.dataset.frameClass || 'lazy-embed-frame';
    frame.title = root.dataset.frameTitle || 'Contenido externo';
    frame.setAttribute('loading', 'eager');
    if (root.dataset.frameAllow) frame.setAttribute('allow', root.dataset.frameAllow);
    if (root.dataset.frameSandbox) frame.setAttribute('sandbox', root.dataset.frameSandbox);
    if (root.dataset.frameAllowFullscreen === 'true') {
      frame.setAttribute('allowfullscreen', '');
      frame.allowFullscreen = true;
    }

    frame.addEventListener('load', succeed, { once: true });
    iframe = frame;
    frame.src = src;
    slot.replaceChildren(frame);

    timeoutId = window.setTimeout(fail, timeoutMs);
  };

  const warm = () => {
    if (warmedUp) return;
    warmedUp = true;
    warmUp(src);
  };

  WARM_EVENTS.forEach((event) =>
    root.addEventListener(event, warm, { passive: true, once: true }),
  );

  root.querySelectorAll('[data-lazy-embed-load], [data-lazy-embed-retry]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      load();
    });
  });

  // Carga automática solo donde es seguro: pantalla grande, sin ahorro de datos
  // ni redes 2G, y únicamente cuando la tarjeta está por entrar en pantalla.
  if (root.dataset.auto === 'desktop' && 'IntersectionObserver' in window) {
    const isDesktop = window.matchMedia(`(min-width: ${MIN_DESKTOP_WIDTH}px)`).matches;
    if (isDesktop && !connectionIsConstrained()) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.disconnect();
            scheduleIdle(load);
            return;
          }
        },
        { rootMargin: '300px 0px' },
      );
      observer.observe(root);
    }
  }

  paint('idle');
}

/** Inicializa todos los embeds diferidos presentes en el documento. */
export function setupLazyEmbeds(): void {
  document.querySelectorAll<HTMLElement>('[data-lazy-embed]').forEach(setupLazyEmbed);
}
