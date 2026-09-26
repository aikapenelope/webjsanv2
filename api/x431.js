/**
 * GET /api/x431?doc=<diagnose_record_id>&rt=<report_type>
 *
 * Informe del scanner X431 (nube de Launch) listo para el render nativo:
 * resumen + sistemas con fallas (código, descripción, estado) + sistemas OK.
 * El informe es inmutable: caché de borde 24 h (SWR 7 días).
 */
const X431 = 'https://usait.x431.com';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({ ok: false, error: 'metodo_no_permitido' });
    return;
  }

  const url = new URL(req.url, 'http://interno');
  const doc = String(req.query?.doc ?? url.searchParams.get('doc') ?? '').trim();
  const rt = String(req.query?.rt ?? url.searchParams.get('rt') ?? '').trim();

  if (!/^[A-Za-z0-9]{6,64}$/.test(doc) || !/^[A-Za-z0-9]{1,8}$/.test(rt)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({ ok: false, error: 'parametros_invalidos' });
    return;
  }

  try {
    const upstream = await fetch(
      `${X431}/Home/Report/getReportInfo?diagnose_record_id=${encodeURIComponent(doc)}&report_type=${encodeURIComponent(rt)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data.code !== 0 || !data.data) throw new Error('sin_respuesta');

    const d = data.data;
    const crudos = Array.isArray(d.technician_result) ? d.technician_result : [];
    const sistemas = [];
    const sistemasOk = [];
    let totalFallas = 0;

    for (const s of crudos) {
      const nombre = String(s?.system_name ?? '').trim();
      const fallas = (s?.subsystem_info?.fault_code_list ?? [])
        .map((fc) => ({
          codigo: String(fc?.fault_code ?? '').trim(),
          descripcion: String(fc?.fault_description ?? '').trim(),
          estado: String(fc?.fault_status ?? '').trim(),
        }))
        .filter((fc) => fc.codigo);
      if (fallas.length > 0) {
        sistemas.push({ nombre, fallas });
        totalFallas += fallas.length;
      } else if (nombre) {
        sistemasOk.push(nombre);
      }
    }

    const inicio = Number(d.diagnose_start_time) || 0;
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({
      ok: true,
      informe: {
        informeId: doc,
        reportType: rt,
        reportCode: String(d.report_code ?? '').trim(),
        fecha: inicio > 0 ? new Date(inicio * 1000).toISOString() : '',
        tester: String(d.tester ?? '').trim(),
        vehiculo: String(d.theme ?? '').trim(),
        vin: String(d.vin ?? '').trim() || undefined,
        duracionSeg: Number(d.time_consuming) || undefined,
        totalSistemas: Number(d.sys_num) || crudos.length,
        totalFallas,
        sistemas,
        sistemasOk,
      },
    });
  } catch (err) {
    console.error('[x431] informe no disponible:', err?.message ?? err);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false, error: 'x431_no_disponible' });
  }
}

export const config = { maxDuration: 30 };
