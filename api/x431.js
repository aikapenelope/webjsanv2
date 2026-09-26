/**
 * GET /api/x431?doc=<diagnose_record_id>&rt=<report_type>
 *
 * Sprint 0: valida parámetros y devuelve un resumen mínimo del informe del scanner
 *           (lectura externa al cloud de Launch — el mismo enlace que se pega en Lark).
 * Sprint 1: DTO completo (sistemas + fallas con descripción) y caché de 24 h.
 *
 * Nota: el informe es inmutable una vez emitido; se cachea agresivamente.
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
    const sistemas = Array.isArray(d.technician_result) ? d.technician_result : [];
    const fallasDetectadas = sistemas.reduce(
      (total, s) => total + (s?.subsystem_info?.fault_code_list?.length ?? 0),
      0,
    );
    const inicio = Number(d.diagnose_start_time) || 0;

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      ok: true,
      informe: {
        informeId: doc,
        reportType: rt,
        reportCode: String(d.report_code ?? ''),
        fecha: inicio > 0 ? new Date(inicio * 1000).toISOString() : '',
        tester: String(d.tester ?? '').trim(),
        vehiculo: String(d.theme ?? '').trim(),
        totalSistemas: Number(d.sys_num) || sistemas.length,
        totalFallas: Number(d.fault_n) || fallasDetectadas,
      },
      _sprint: 'Sprint 0 · resumen mínimo. Sistemas y fallas detalladas llegan en el Sprint 1.',
    });
  } catch (err) {
    console.error('[x431] informe no disponible:', err?.message ?? err);
    res.setHeader('Cache-Control', 'no-store');
    // 200 con ok:false para que la web muestre su respaldo (enlace al original) sin romperse.
    res.status(200).json({ ok: false, error: 'x431_no_disponible' });
  }
}

export const config = { maxDuration: 30 };
