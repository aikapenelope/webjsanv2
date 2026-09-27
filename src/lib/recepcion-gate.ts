/**
 * recepcion-gate — Puerta de acceso al formulario oficial de recepción (Sprint A).
 *
 * PROBLEMA QUE RESUELVE
 * La URL del formulario de Lark estaba publicada en el HTML de /recepcion/: un
 * bot podía extraerla y usarla. Ahora el HTML no la contiene en ningún punto.
 *
 * FLUJO
 *  1. El usuario pide abrir la planilla → se resuelve el reto de Cloudflare
 *     Turnstile (script precalentado tras el «idle» + preconnect: el clic no
 *     espera DNS/TLS ni la descarga).
 *  2. El token (de un solo uso) se canjea en `/api/recepcion-acceso`, que lo
 *     valida contra Cloudflare y devuelve la URL del formulario real.
 *  3. Esa URL (el formulario real, validada en el servidor) se entrega solo tras
 *     el gate; el iframe y los enlaces «Pantalla completa» se generan ahí,
 *     preconectando el host del formulario justo antes de cargarlo.
 *
 * Degradación: sin claves configuradas o si Turnstile/el API fallan, se muestra
 * un aviso amable + el WhatsApp del taller (nunca una página rota).
 */
import { openLazyEmbed, resetLazyEmbed, setupLazyEmbeds } from './lazyEmbed';

const SCRIPT_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';


interface TurnstileApi {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let cargaTurnstile: Promise<TurnstileApi> | null = null;

/** preconnect + dns-prefetch idempotentes (una vez por origen). */
function preconectar(origen: string): void {
  if (document.head.querySelector(`link[data-gate-preconnect="${origen}"]`)) return;
  const dns = document.createElement('link');
  dns.rel = 'dns-prefetch';
  dns.href = origen;
  dns.setAttribute('data-gate-preconnect', origen);
  const pre = document.createElement('link');
  pre.rel = 'preconnect';
  pre.href = origen;
  pre.setAttribute('data-gate-preconnect', origen);
  document.head.append(dns, pre);
}

function cargarTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (cargaTurnstile) return cargaTurnstile;
  cargaTurnstile = new Promise<TurnstileApi>((resolve, reject) => {
    const yaExiste = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_TURNSTILE}"]`);
    const script = yaExiste ?? document.createElement('script');
    const temporizador = window.setTimeout(() => {
      reject(new Error('Turnstile tardó demasiado'));
    }, 15000);
    const alCargar = () => {
      window.clearTimeout(temporizador);
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile no disponible'));
    };
    const alFallar = () => {
      window.clearTimeout(temporizador);
      reject(new Error('No se pudo cargar Turnstile'));
    };
    if (yaExiste) {
      yaExiste.addEventListener('load', alCargar, { once: true });
      yaExiste.addEventListener('error', alFallar, { once: true });
      return;
    }
    script.src = SCRIPT_TURNSTILE;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', alCargar, { once: true });
    script.addEventListener('error', alFallar, { once: true });
    document.head.append(script);
  });
  cargaTurnstile = cargaTurnstile.catch((error: unknown) => {
    cargaTurnstile = null;
    throw error;
  });
  return cargaTurnstile;
}

function mostrar(el: Element | null, visible: boolean): void {
  if (!el) return;
  if (visible) el.removeAttribute('hidden');
  else el.setAttribute('hidden', '');
}

function inicializar(root: HTMLElement): void {
  if (root.dataset.recepcionGateReady === '1') return;
  root.dataset.recepcionGateReady = '1';

  const sitekey = (root.dataset.sitekey ?? '').trim();
  const boton = root.querySelector<HTMLButtonElement>('[data-recepcion-gate-start]');
  const widget = root.querySelector<HTMLElement>('[data-recepcion-gate-widget]');
  const linea = root.querySelector<HTMLElement>('[data-recepcion-gate-estado]');
  const aviso = root.querySelector<HTMLElement>('[data-recepcion-gate-noconfig]');
  const cajaError = root.querySelector<HTMLElement>('[data-recepcion-gate-error]');
  const errorTexto = root.querySelector<HTMLElement>('[data-recepcion-gate-error-texto]');
  if (!boton || !widget) return;

  const embed = document.querySelector<HTMLElement>('[data-recepcion-embed]');
  let widgetId: string | null = null;

  const estado = (valor: string) => {
    root.dataset.recepcionGateState = valor;
  };

  if (!sitekey) {
    mostrar(boton, false);
    mostrar(aviso, true);
    estado('sin-configurar');
    return;
  }

  // Precalentamiento: preconecta y descarga el script de Turnstile tras el
  // «idle» para que el clic del usuario no espere red (se reintenta al pedir).
  preconectar('https://challenges.cloudflare.com');
  const precalentar = () => {
    void cargarTurnstile().catch(() => {
      /* sin drama: al pedir la planilla se vuelve a intentar */
    });
  };
  const idle = (
    window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  ).requestIdleCallback;
  if (typeof idle === 'function') idle(precalentar, { timeout: 3000 });
  else window.setTimeout(precalentar, 2500);

  const aplicarAcceso = (url: string) => {
    // El formulario se sirve directo a navegadores reales: preconectar su host
    // justo antes de cargar el iframe ahorra DNS+TLS en la primera visita.
    try {
      preconectar(new URL(url).origin);
    } catch {
      /* la URL ya viene validada; sin drama si algo raro pasa */
    }
    document.querySelectorAll<HTMLAnchorElement>('[data-recepcion-gated-link]').forEach((enlace) => {
      enlace.href = url;
      enlace.removeAttribute('hidden');
    });
    document.querySelectorAll<HTMLElement>('[data-recepcion-gated-block]').forEach((bloque) => {
      bloque.removeAttribute('hidden');
    });
    document.querySelectorAll<HTMLElement>('[data-recepcion-gate-pre]').forEach((previo) => {
      previo.setAttribute('hidden', '');
    });
    if (embed) {
      resetLazyEmbed(embed);
      embed.setAttribute('data-lazy-embed', '');
      embed.dataset.src = url;
      setupLazyEmbeds();
      openLazyEmbed(embed);
    }
    estado('listo');
  };

  const fallo = (mensaje?: string) => {
    estado('error');
    mostrar(widget, false);
    mostrar(linea, false);
    if (errorTexto && mensaje) errorTexto.textContent = mensaje;
    mostrar(cajaError, true);
    mostrar(boton, true);
    boton.textContent = 'Reintentar verificación';
  };

  const canjear = async (token: string) => {
    estado('verificando');
    mostrar(widget, false);
    mostrar(cajaError, false);
    if (linea) linea.textContent = 'Verificando que eres una persona…';
    mostrar(linea, true);
    try {
      const res = await fetch('/api/recepcion-acceso?token=' + encodeURIComponent(token), {
        headers: { accept: 'application/json' },
      });
      const datos: { ok?: boolean; url?: string; mensaje?: string } = await res
        .json()
        .catch(() => ({}));
      if (
        res.ok &&
        datos.ok === true &&
        typeof datos.url === 'string' &&
        /^https:\/\/[^\s]*larksuite\.com\//i.test(datos.url)
      ) {
        mostrar(linea, false);
        aplicarAcceso(datos.url);
        return;
      }
      fallo(datos.mensaje);
    } catch {
      fallo();
    }
  };

  const pedirAcceso = async () => {
    mostrar(cajaError, false);
    mostrar(boton, false);
    if (linea) linea.textContent = 'Cargando la verificación de seguridad…';
    mostrar(linea, true);
    try {
      const api = await cargarTurnstile();
      mostrar(linea, false);
      mostrar(widget, true);
      if (widgetId) {
        api.reset(widgetId);
        return;
      }
      widgetId = api.render(widget, {
        sitekey,
        theme: 'light',
        language: 'es',
        appearance: 'interaction-only',
        retry: 'auto',
        'refresh-expired': 'auto',
        callback: (token: string) => {
          void canjear(token);
        },
        'error-callback': () => fallo('No pudimos completar la verificación. Inténtalo de nuevo.'),
        'expired-callback': () => fallo('La verificación expiró. Inténtalo de nuevo.'),
        'timeout-callback': () => fallo('La verificación tardó demasiado. Inténtalo de nuevo.'),
      });
    } catch {
      fallo('No pudimos cargar la verificación de seguridad. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  boton.addEventListener('click', () => {
    void pedirAcceso();
  });

  estado('inicial');
}

/** Inicializa la puerta de recepción (idempotente, compatible con ClientRouter). */
export function setupRecepcionGate(): void {
  document.querySelectorAll<HTMLElement>('[data-recepcion-gate]').forEach(inicializar);
}
