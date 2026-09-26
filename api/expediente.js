/**
 * GET /api/expediente?placa=AE473LM
 *
 * Expediente completo del vehículo (100% lectura):
 * vehículo · órdenes con tracker · recepción + fotos de la visita más reciente ·
 * referencia del informe X431 · señal de garantía.
 * Los videos NO se firman: solo se cuenta su cantidad (aviso por WhatsApp).
 *
 * Caché de borde: 60 s + SWR 600 s. Errores y excesos de límite: sin caché.
 */
import { normalizarPlaca, placaValida } from './_lib/expediente.js';
import { construirExpediente } from './_lib/fanout.js';

/* Rate-limit básico por IP (best-effort por instancia): 30 rpm */
const LIMITE_POR_MINUTO = 30;
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({ ok: false, error: 'metodo_no_permitido' });
    return;
  }

  const ip =
    String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim() ||
    String(req.headers?.['x-real-ip'] ?? '') ||
    'desconocida';
  const esperar = excesoDeLimite(ip);
  if (esperar > 0) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', String(esperar));
    res.status(429).json({
      ok: false,
      error: 'demasiadas_solicitudes',
      mensaje: 'Espera unos segundos e intenta de nuevo.',
    });
    return;
  }

  const url = new URL(req.url, 'http://interno');
  const placa = normalizarPlaca(req.query?.placa ?? url.searchParams.get('placa'));

  if (!placaValida(placa)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({
      ok: false,
      error: 'placa_invalida',
      mensaje: 'Escribe una placa válida, por ejemplo: AE473LM.',
    });
    return;
  }

  try {
    const expediente = await construirExpediente(placa);

    if (!expediente) {
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
      res.status(200).json({
        ok: true,
        encontrado: false,
        placa,
        actualizado: new Date().toISOString(),
      });
      return;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.status(200).json({ ok: true, encontrado: true, ...expediente });
  } catch (err) {
    console.error('[expediente] Lark no disponible:', err?.message ?? err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({
      ok: false,
      error: 'lark_no_disponible',
      mensaje: 'No pudimos consultar el taller en este momento. Intenta de nuevo en unos segundos.',
    });
  }
}

export const config = { maxDuration: 30 };
