/**
 * GET /api/recepcion-acceso?token=<turnstile>
 *
 * Puerta del formulario de recepción (Sprint A):
 *  1. rate-limit por IP (best-effort por instancia),
 *  2. valida el token de Cloudflare Turnstile (de un solo uso, ~5 min),
 *  3. devuelve una URL firmada de vida corta para abrir el formulario real.
 *
 * La URL de Lark NUNCA viaja en el HTML de /recepcion/: solo se entrega aquí,
 * tras pasar el reto anti-bots, y llega redirigida desde /api/recepcion-form.
 */
import {
  firmarAcceso,
  turnstileConfigurado,
  urlFormulario,
  verificarTurnstile,
} from './_lib/recepcion.js';

const LIMITE_POR_MINUTO = 10;
const VENTANA_MS = 60_000;
const golpes = new Map();

function excesoDeLimite(ip) {
  const ahora = Date.now();
  const recientes = (golpes.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= LIMITE_POR_MINUTO) {
    golpes.set(ip, recientes);
    return Math.max(1, Math.ceil((VENTANA_MS - (ahora - recientes[0])) / 1000));
  }
  recientes.push(ahora);
  golpes.set(ip, recientes);
  if (golpes.size > 5000) {
    for (const [clave, marcas] of golpes) {
      if (!marcas.some((t) => ahora - t < VENTANA_MS)) golpes.delete(clave);
    }
  }
  return 0;
}

function respuesta(res, status, cuerpo) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(cuerpo);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    respuesta(res, 405, { ok: false, error: 'metodo_no_permitido' });
    return;
  }

  const ip =
    String(req.headers?.['x-real-ip'] ?? '').trim() ||
    String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim() ||
    'desconocida';
  const esperar = excesoDeLimite(ip);
  if (esperar > 0) {
    res.setHeader('Retry-After', String(esperar));
    respuesta(res, 429, {
      ok: false,
      error: 'demasiadas_solicitudes',
      mensaje: 'Espera unos segundos e intenta de nuevo.',
    });
    return;
  }

  const url = new URL(req.url, 'http://interno');
  const token = String(req.query?.token ?? url.searchParams.get('token') ?? '').trim();
  if (!token) {
    respuesta(res, 400, { ok: false, error: 'token_ausente' });
    return;
  }

  if (!turnstileConfigurado() || !urlFormulario()) {
    respuesta(res, 503, {
      ok: false,
      error: 'no_configurado',
      mensaje:
        'La verificación de acceso aún no está activa. Escríbenos por WhatsApp y te enviamos la planilla.',
    });
    return;
  }

  let valido = false;
  try {
    valido = await verificarTurnstile(token, ip);
  } catch (err) {
    console.error('[recepcion-acceso] Turnstile inalcanzable:', err?.message ?? err);
    respuesta(res, 502, {
      ok: false,
      error: 'verificacion_no_disponible',
      mensaje: 'No pudimos verificar el acceso en este momento. Intenta de nuevo en unos segundos.',
    });
    return;
  }
  if (!valido) {
    respuesta(res, 403, {
      ok: false,
      error: 'verificacion_fallida',
      mensaje: 'La verificación no se completó. Recarga e inténtalo de nuevo.',
    });
    return;
  }

  respuesta(res, 200, { ok: true, url: '/api/recepcion-form?t=' + firmarAcceso() });
}
