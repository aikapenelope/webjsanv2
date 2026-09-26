/**
 * GET /api/expediente?placa=AE473LM
 *
 * Sprint 0: valida la placa y responde el bloque del vehículo (lectura real de Lark).
 * Sprint 1: completará el expediente — OTs, recepción + fotos, informes X431,
 *           señal de garantía e historial por placa.
 *
 * 100% lectura: este endpoint NO escribe nada en Lark.
 */
import {
  buscarRegistros,
  placaValida,
  normalizarPlaca,
  porPlacaNorm,
  TABLAS,
  textoDe,
  numeroDe,
  linkIdsDe,
} from './_lib/expediente.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({ ok: false, error: 'metodo_no_permitido' });
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
    const { items } = await buscarRegistros(TABLAS.vehiculos, porPlacaNorm(placa), { pageSize: 5 });

    // Datos de vehículo: se cachean 60 s en el borde y se refrescan solos (SWR).
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');

    if (items.length === 0) {
      res.status(200).json({
        ok: true,
        encontrado: false,
        placa,
        actualizado: new Date().toISOString(),
      });
      return;
    }

    const f = items[0].fields ?? {};
    res.status(200).json({
      ok: true,
      encontrado: true,
      placa,
      actualizado: new Date().toISOString(),
      vehiculo: {
        marcaModelo: textoDe(f['Marca / Modelo']).trim(),
        ano: numeroDe(f['Año']),
        color: textoDe(f['Color']).trim() || undefined,
        vin: textoDe(f['VIN']).trim() || undefined,
        kmUltimaVisita: numeroDe(f['Km última visita']),
        totalOTs: linkIdsDe(f['OTs del vehículo']).length,
      },
      _sprint: 'Sprint 0 · bloque del vehículo. El expediente completo llega en el Sprint 1.',
    });
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
