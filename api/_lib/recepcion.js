/**
 * Núcleo del blindaje del formulario de recepción (Sprint A) — 100% servidor.
 *
 * Reglas:
 *  · La URL real del formulario de Lark NO vive en el código ni en el HTML:
 *    se lee de la variable de entorno LARK_FORM_URL.
 *  · El navegador pasa primero Cloudflare Turnstile (token de un solo uso) y
 *    canjea ese token por una URL firmada (HMAC-SHA256) de vida corta.
 *  · Sin estado: la firma es `exp.firma` (exp en segundos UNIX, firma base64url).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TURNSTILE_SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Vida del enlace firmado que se entrega tras pasar el gate (10 min). */
export const TTL_ACCESO_S = 10 * 60;
/** Tolerancia de reloj al validar `exp`. */
const MARGEN_S = 120;

/** Secreto para firmar la URL de acceso (el de Turnstile sirve de respaldo). */
export function secretoHmac() {
  return String(process.env.RECEPCION_HMAC_SECRET || process.env.TURNSTILE_SECRET_KEY || '');
}

export function turnstileConfigurado() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * URL oficial del formulario (solo servidor). Se valida que sea https en un
 * dominio de Lark para que un error de configuración no pueda redirigir a otro
 * sitio.
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

const firmar = (payload) =>
  createHmac('sha256', secretoHmac()).update(payload).digest('base64url');

/** Firma un acceso corto: `exp.firma(exp)` (exp en segundos UNIX). */
export function firmarAcceso(ahoraMs = Date.now()) {
  const exp = Math.floor(ahoraMs / 1000) + TTL_ACCESO_S;
  return exp + '.' + firmar(String(exp));
}

/** Valida la firma y su ventana temporal (± MARGEN_S). */
export function validarAcceso(token, ahoraMs = Date.now()) {
  const t = String(token ?? '');
  const punto = t.indexOf('.');
  if (punto <= 0) return false;
  const exp = Number(t.slice(0, punto));
  const firma = t.slice(punto + 1);
  if (!Number.isFinite(exp) || !firma) return false;
  const ahora = Math.floor(ahoraMs / 1000);
  if (exp < ahora - MARGEN_S || exp > ahora + TTL_ACCESO_S + MARGEN_S) return false;
  const esperada = firmar(String(exp));
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
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
