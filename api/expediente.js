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
import { construirExpediente, verificarTelefono } from './_lib/fanout.js';

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

  // IP confiable: `x-real-ip` la calcula el proxy de Vercel (la guía oficial
  // de @vercel/functions usa esta cabecera; `x-forwarded-for` puede venir
  // influida por el cliente, así que solo se usa como respaldo).
  const ip =
    String(req.headers?.['x-real-ip'] ?? '').trim() ||
    String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim() ||
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

  const t4 = String(req.query?.t4 ?? url.searchParams.get('t4') ?? '').trim();
  if (!/^\d{4}$/.test(t4)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({
      ok: false,
      error: 't4_invalido',
      mensaje: 'Escribe los últimos 4 dígitos del teléfono con el que registramos tu vehículo.',
    });
    return;
  }

  // Segundo factor ANTES del fan-out: los intentos inválidos no gastan las 5
  // búsquedas completas ni permiten enumerar expedientes con solo la placa.
  try {
    const acceso = await verificarTelefono(placa, t4);
    if (acceso !== 'ok') {
      const sinTelefono = acceso === 'sin_telefono';
      res.setHeader('Cache-Control', 'no-store');
      res.status(403).json({
        ok: false,
        error: sinTelefono ? 'telefono_no_registrado' : 'telefono_no_coincide',
        mensaje: sinTelefono
          ? 'Aún no tenemos un teléfono registrado para esta placa. Escríbenos por WhatsApp y lo registramos en minutos.'
          : 'Los últimos 4 dígitos no coinciden con el teléfono registrado en la recepción.',
        whatsappUrl:
          'https://wa.me/584141066546?text=' +
          encodeURIComponent(
            (sinTelefono
              ? 'Hola J-SAN, quiero consultar el expediente de mi vehículo placa '
              : 'Hola J-SAN, no puedo consultar el expediente de mi vehículo placa ') +
              placa +
              ' y necesito ayuda con el teléfono registrado.',
          ),
      });
      return;
    }
  } catch (err) {
    console.error('[expediente] verificación de teléfono falló:', err?.message ?? err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({
      ok: false,
      error: 'lark_no_disponible',
      mensaje: 'No pudimos verificar tus datos en este momento. Intenta de nuevo en unos segundos.',
    });
    return;
  }

  try {
    const expediente = await construirExpediente(placa);

    if (!expediente) {
      // Una placa inexistente también cuesta 5 búsquedas: se cachea 3 min.
      console.log('[expediente] fanout sin resultado');
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=180, stale-while-revalidate=1800');
      res.status(200).json({
        ok: true,
        encontrado: false,
        placa,
        actualizado: new Date().toISOString(),
      });
      return;
    }

    // Consumo de API: una orden entregada o cancelada ya no cambia (10 min de
    // caché en el borde y 2 min en el navegador); una activa se refresca cada
    // 2,5 min. Así una placa popular no golpea a Lark más de lo necesario.
    const etapa = expediente.ordenes?.[0]?.etapa;
    const estable = etapa === 6 || etapa === -1;
    console.log('[expediente] fanout ok · etapa=' + (etapa ?? '?'));
    res.setHeader(
      'Cache-Control',
      estable
        ? 'public, max-age=120, s-maxage=600, stale-while-revalidate=86400'
        : 'public, max-age=45, s-maxage=150, stale-while-revalidate=900',
    );
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
