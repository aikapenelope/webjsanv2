/**
 * GET /api/foto?t=<file_token>&w=<ancho>&e=<expira>&s=<firma>
 *
 * Proxy de fotos del expediente (100% lectura):
 *  · Firma la URL temporal del adjunto con el bot (mismo camino que el fanout:
 *    `batch_get_tmp_download_url`) y baja por ahí.
 *    ⚠️ `drive/v1/medias/{token}/download` NO sirve: el bot recibe HTTP 403
 *    (verificado 2026-09-29 con la misma app) aunque el usuario sí pueda.
 *  · Endereza la orientación EXIF y reescala al ancho pedido
 *    (640 carrusel · 1280 visor · 0 original).
 *  · Devuelve JPEG cacheable (7 días) — a diferencia de Lark, que sirve
 *    `no-store` y obliga a re-descargar en cada apertura.
 *
 * La firma HMAC (ver `_lib/foto-firma.js`) impide usar el endpoint para
 * pedir otras fotos: sin firma válida responde 400/403 y no toca Lark.
 */
import sharp from 'sharp';
import { firmarFotos as firmarAdjuntosLark } from './_lib/expediente.js';
import {
  verificarFoto,
  ANCHO_MINI,
  ANCHO_VISOR,
  ANCHO_ORIGINAL,
} from './_lib/foto-firma.js';

const ANCHOS = new Set([ANCHO_ORIGINAL, ANCHO_MINI, ANCHO_VISOR]);
const CACHE = 'public, max-age=604800, s-maxage=604800, immutable';

const calidad = (ancho) => (ancho === ANCHO_ORIGINAL ? 90 : ancho === ANCHO_VISOR ? 78 : 80);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({ ok: false, error: 'metodo_no_permitido' });
    return;
  }

  const url = new URL(req.url, 'http://interno');
  const t = String(req.query?.t ?? url.searchParams.get('t') ?? '').trim();
  const w = Number(req.query?.w ?? url.searchParams.get('w') ?? NaN);
  const e = String(req.query?.e ?? url.searchParams.get('e') ?? '').trim();
  const s = String(req.query?.s ?? url.searchParams.get('s') ?? '').trim();

  if (!/^[A-Za-z0-9]{8,128}$/.test(t) || !ANCHOS.has(w) || !/^\d{9,12}$/.test(e) || !s) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({ ok: false, error: 'parametros_invalidos' });
    return;
  }

  if (!verificarFoto(t, w, e, s)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(403).json({ ok: false, error: 'firma_invalida' });
    return;
  }

  try {
    // El bot no puede descargar directo (403 probado); firma temporal y baja.
    const firmadas = await firmarAdjuntosLark([t]);
    const urlOriginal = firmadas.get(t);
    if (!urlOriginal) throw new Error('sin_firma_lark');

    const upstream = await fetch(urlOriginal, { signal: AbortSignal.timeout(15_000) });
    if (!upstream.ok) throw new Error('lark ' + upstream.status);

    const tipo = String(upstream.headers.get('content-type') || '');
    if (!tipo.startsWith('image/')) throw new Error('no_es_imagen: ' + tipo);

    const original = Buffer.from(await upstream.arrayBuffer());

    let lona = sharp(original, { failOn: 'none' }).rotate(); // EXIF: endereza
    if (w > 0) lona = lona.resize({ width: w, withoutEnlargement: true });
    const jpeg = await lona.jpeg({ quality: calidad(w) }).toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', CACHE);
    res.status(200).send(jpeg);
  } catch (err) {
    console.error('[foto] no disponible:', err?.message ?? err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: 'foto_no_disponible' });
  }
}

export const config = { maxDuration: 30 };
