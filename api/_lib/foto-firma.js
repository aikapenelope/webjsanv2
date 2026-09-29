/**
 * Firma de URLs de fotos — el portal nunca expone la firma cruda de Lark.
 *
 * `/api/expediente` emite por cada foto una URL `/api/foto?t=…&w=…&e=…&s=…`
 * firmada con HMAC-SHA256: la firma vale SOLO para ese file_token + ancho, no
 * permite pedir otras fotos y caduca sola. La expiración se redondea a la hora
 * para que la URL sea estable dentro de la hora (caché de navegador/borde) sin
 * volverse eterna.
 *
 * El secreto es `FOTO_HMAC_SECRET` si existe; si no, se reutiliza
 * `LARK_APP_SECRET` (ya configurado en Vercel) para no exigir variables nuevas.
 * Sin secreto, `firmarFoto` devuelve '' y el llamador usa la URL firmada de
 * Lark como hasta ahora (degradación elegante).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Anchos servidos por el proxy (whitelist). 0 = original sin reescalar. */
export const ANCHO_MINI = 640;
export const ANCHO_VISOR = 1280;
export const ANCHO_ORIGINAL = 0;

const VALIDEZ_SEGUNDOS = 7 * 24 * 60 * 60; // 7 días
// La firma cambia una vez por día: la URL es estable y la caché de borde queda
// tibia todo el día (con bucket horario, el primer visitante de cada hora pagaba
// la conversión de sharp). La ventana de exposición no cambia: 7 días igual.
const BUCKET_SEGUNDOS = 24 * 60 * 60;

const secreto = () => process.env.FOTO_HMAC_SECRET || process.env.LARK_APP_SECRET || '';

const firmar = (token, ancho, expira, clave) =>
  createHmac('sha256', clave).update(`${token}.${ancho}.${expira}`).digest('base64url');

/**
 * Query firmada (sin `?`) para `/api/foto`, o '' si no hay secreto/token.
 * `ahora` es inyectable para pruebas.
 */
export function firmarFoto(token, ancho, ahora = Date.now()) {
  const clave = secreto();
  if (!clave || !token) return '';
  const bucket = Math.ceil(ahora / 1000 / BUCKET_SEGUNDOS) * BUCKET_SEGUNDOS;
  const expira = String(bucket + VALIDEZ_SEGUNDOS);
  const s = firmar(token, ancho, expira, clave);
  return new URLSearchParams({ t: token, w: String(ancho), e: expira, s }).toString();
}

/** Verifica los parámetros de `/api/foto`. */
export function verificarFoto(token, ancho, expira, s, ahora = Date.now()) {
  const clave = secreto();
  if (!clave || !token) return false;
  const e = Number(expira);
  const ahoraSegundos = Math.floor(ahora / 1000);
  if (!Number.isFinite(e) || e <= ahoraSegundos || e > ahoraSegundos + VALIDEZ_SEGUNDOS + BUCKET_SEGUNDOS) {
    return false;
  }
  const esperado = Buffer.from(firmar(token, ancho, expira, clave));
  const recibido = Buffer.from(String(s ?? ''));
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}
