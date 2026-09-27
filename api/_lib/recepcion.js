/**
 * Núcleo del blindaje del formulario de recepción (Sprint A) — 100% servidor.
 *
 * Reglas:
 *  · La URL real del formulario de Lark NO vive en el código ni en el HTML:
 *    se lee de la variable de entorno LARK_FORM_URL y solo se entrega después
 *    de pasar Cloudflare Turnstile (token de un solo uso, ~5 min).
 *  · Sin estado: no se firma nada; la protección es el propio token de
 *    Turnstile + el rate-limit por IP del endpoint.
 */
export const TURNSTILE_SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileConfigurado() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * URL oficial del formulario (solo servidor). Se valida que sea https en un
 * dominio de Lark para que un error de configuración no pueda entregar otra
 * cosa.
 */
export function urlFormulario() {
  const bruto = String(process.env.LARK_FORM_URL ?? '').trim();
  if (!bruto) return '';
  try {
    const u = new URL(bruto);
    if (u.protocol !== 'https:') return '';
    if (!/(^|\.)larksuite\.com$/i.test(u.hostname)) return '';
    return u.href;
  } catch {
    return '';
  }
}

/**
 * Verifica el token de Turnstile contra Cloudflare (POST form-encoded).
 * Devuelve true/false; lanza solo si la red con Cloudflare falla.
 */
export async function verificarTurnstile(token, ip = '') {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  const cuerpo = new URLSearchParams({ secret, response: String(token ?? '') });
  if (ip && ip !== 'desconocida') cuerpo.set('remoteip', ip);
  const res = await fetch(TURNSTILE_SITEVERIFY, { method: 'POST', body: cuerpo });
  const data = await res.json().catch(() => ({}));
  return res.ok && data?.success === true;
}
