/**
 * Fan-out del expediente completo — Sprint 1.
 *
 * Arma el DTO del Portal a partir de la Base con LISTA BLANCA estricta
 * (campo por campo; nunca spread de `fields`).
 * 100% lectura: no escribe nada en Lark ni toca workflows/esquema.
 */
import {
  TABLAS,
  buscarRegistros,
  porPlacaNorm,
  textoDe,
  numeroDe,
  linkIdsDe,
  firmarFotos,
  extraerInformeX431,
  normalizarPlaca,
  aISO,
} from './expediente.js';

/** WhatsApp oficial del taller (fuente: src/data/site.ts). */
const WA_TALLER = '584141066546';

/* ───────────────────────── Estados → etapa del tracker ─────────────────────── */
/** 0..6 = pipeline · -1 cancelado · -2 imprevisto / en espera */
export function etapaDeEstado(estado) {
  const s = String(estado ?? '');
  if (s.includes('Cancelado')) return -1;
  if (s.includes('Imprevisto')) return -2;
  if (s.includes('Entregado')) return 6;
  if (s.includes('Listo')) return 5;
  if (s.includes('Trabajo')) return 4;
  if (s.includes('Aprobado')) return 3;
  if (s.includes('Aprobar')) return 2;
  if (s.includes('Diagn')) return 1; // 🔍 En Diagnóstico
  return 0; // 🔴 Recibido (y respaldo)
}

/* ─────────────────────────────── Adjuntos ──────────────────────────────────── */
function adjuntosDe(valor) {
  if (!Array.isArray(valor)) return [];
  return valor.filter((a) => a && typeof a === 'object' && a.file_token);
}
const esImagen = (a) => String(a?.type ?? '').startsWith('image/');
const esVideo = (a) => String(a?.type ?? '').startsWith('video/');

/** Campos de texto del diagnóstico donde puede vivir la URL del informe X431. */
function textosDiagnostico(f = {}) {
  return [
    textoDe(f['DTCs / Errores computadora']),
    textoDe(f['Relato completo del diagnóstico']),
    textoDe(f['🔧 Hallazgos del desmontaje']),
  ].filter(Boolean);
}

/* ────────────── Correlación Recepción ↔ OT (placa + cercanía temporal) ─────── */
function asignarRecepciones(ordenes, entradas) {
  const usadas = new Set();
  const mapa = new Map();
  const VENTANA_PREVIA = 7 * 24 * 60 * 60 * 1000; // entrada hasta 7 días antes
  const TOLERANCIA_POST = 10 * 60 * 1000; // tolerancia por relojes/W1b

  for (const ot of [...ordenes].sort((a, b) => a.ts - b.ts)) {
    let mejor = null;
    let mejorPref = Infinity;
    let mejorAbs = Infinity;
    for (const e of entradas) {
      if (usadas.has(e.record_id)) continue;
      const delta = ot.ts - e.ts; // ≥0 = entrada antes de la OT (caso normal)
      const enVentana = delta >= -TOLERANCIA_POST && delta <= VENTANA_PREVIA;
      const pref = enVentana ? 0 : 1;
      const abs = Math.abs(delta);
      if (pref < mejorPref || (pref === mejorPref && abs < mejorAbs)) {
        mejor = e;
        mejorPref = pref;
        mejorAbs = abs;
      }
    }
    if (mejor) {
      usadas.add(mejor.record_id);
      mapa.set(ot.record_id, mejor);
    }
  }
  return mapa;
}

/* ─────────────────────────── Garantías por placa ───────────────────────────── */
async function buscarGarantias(placa) {
  const directo = await buscarRegistros(
    TABLAS.garantias,
    [{ field_name: 'Placa', operator: 'is', value: [placa] }],
    { pageSize: 200 },
  );
  if (directo.items.length > 0) return directo.items;
  // Respaldo: `Placa` es texto libre y puede traer formato sucio ("AE-473-LM")
  const todas = await buscarRegistros(TABLAS.garantias, [], { pageSize: 500 });
  return todas.items.filter((it) => normalizarPlaca(textoDe(it.fields?.['Placa'])) === placa);
}

const waGarantia = (placa) =>
  `https://wa.me/${WA_TALLER}?text=${encodeURIComponent(
    `Hola J-SAN, quiero detalles de la garantía de mi vehículo placa ${placa}.`,
  )}`;

/* ───────────────────────────── Expediente completo ─────────────────────────── */

export async function construirExpediente(placa) {
  const [veh, ots, entradas, dxs, gars] = await Promise.all([
    buscarRegistros(TABLAS.vehiculos, porPlacaNorm(placa), { pageSize: 5 }),
    buscarRegistros(TABLAS.ordenes, porPlacaNorm(placa), { pageSize: 100 }),
    buscarRegistros(TABLAS.recepcion, porPlacaNorm(placa), { pageSize: 100 }),
    buscarRegistros(TABLAS.diagnosticos, porPlacaNorm(placa), { pageSize: 100 }),
    buscarGarantias(placa),
  ]);

  const ordenes = ots.items
    .map((it) => ({
      record_id: it.record_id,
      f: it.fields ?? {},
      ts: numeroDe(it.fields?.['📅 Fecha ingreso']) ?? 0,
    }))
    .sort((a, b) => b.ts - a.ts);

  const entradasNorm = entradas.items.map((it) => ({
    record_id: it.record_id,
    f: it.fields ?? {},
    ts: numeroDe(it.fields?.['📅 Fecha']) ?? 0,
  }));

  const vehiculoBase = veh.items[0]?.fields ?? null;
  if (!vehiculoBase && ordenes.length === 0 && entradasNorm.length === 0 && gars.length === 0) {
    return null; // placa desconocida
  }

  // Diagnósticos: vinculados a OT + pozo de no vinculados (respaldo por placa)
  const dxsNorm = dxs.items.map((it) => ({
    ts: numeroDe(it.fields?.['📅 Fecha']) ?? 0,
    otIds: linkIdsDe(it.fields?.['OT vinculada']),
    informe: extraerInformeX431(textosDiagnostico(it.fields ?? {})),
  }));
  const porOt = new Map();
  const pozo = [];
  for (const dx of dxsNorm) {
    if (dx.otIds.length > 0) {
      for (const otId of dx.otIds) porOt.set(otId, [...(porOt.get(otId) ?? []), dx]);
    } else {
      pozo.push(dx);
    }
  }

  const informeDeOrden = (ot) => {
    let candidatos = porOt.get(ot.record_id) ?? [];
    if (!candidatos.some((d) => d.informe)) {
      let mejor = null;
      let mejorAbs = Infinity;
      for (const d of pozo) {
        const abs = Math.abs(d.ts - ot.ts);
        if (abs < mejorAbs) {
          mejor = d;
          mejorAbs = abs;
        }
      }
      if (mejor && mejorAbs <= 60 * 24 * 60 * 60 * 1000) candidatos = candidatos.concat([mejor]);
    }
    return candidatos.find((d) => d.informe)?.informe ?? null;
  };

  // Recepción correlacionada + firmas SOLO de la visita más reciente
  const asignadas = asignarRecepciones(ordenes, entradasNorm);
  const base = ordenes.map((ot) => {
    const rec = asignadas.get(ot.record_id);
    const adjuntos = adjuntosDe(rec?.f?.['Fotos']);
    return { ot, rec, imagenes: adjuntos.filter(esImagen), videos: adjuntos.filter(esVideo).length };
  });

  const urlsFotos = new Map();
  if (base[0]?.imagenes.length) {
    const firmadas = await firmarFotos(base[0].imagenes.map((a) => a.file_token));
    for (const [token, url] of firmadas) urlsFotos.set(token, url);
  }

  const ordenesDto = base.map(({ ot, rec, imagenes, videos }, idx) => {
    const f = ot.f;
    const rf = rec?.f ?? {};
    const sintoma =
      textoDe(rf['¿Qué le pasa al carro?']).trim() || textoDe(f['Síntoma reportado']).trim();
    const km = numeroDe(rf['Km reportado']) ?? numeroDe(f['Km entrada']);

    const dto = {
      nroOT: textoDe(f['# OT']).trim(),
      estado: textoDe(f['Estado']).trim(),
      etapa: etapaDeEstado(textoDe(f['Estado'])),
      diasEnTaller: numeroDe(f['Días en taller']),
      fechaIngreso: aISO(ot.ts),
      fechaEntrega: aISO(numeroDe(f['Fecha entrega'])) || undefined,
      kmEntrada: numeroDe(f['Km entrada']),
      sintoma: textoDe(f['Síntoma reportado']).trim() || undefined,
    };

    if (rec) {
      dto.recepcion = {
        nroEntrada: textoDe(rf['🔢 N° entrada']).trim(),
        fecha: aISO(numeroDe(rf['📅 Fecha'])),
        km,
        sintoma,
        fotos:
          idx === 0
            ? imagenes
                .map((a) => ({
                  nombre: String(a.name ?? 'foto'),
                  mime: String(a.type ?? 'image/jpeg'),
                  tamano: Number(a.size) || 0,
                  url: urlsFotos.get(a.file_token) ?? '',
                }))
                .filter((foto) => foto.url)
            : [],
        videos: { cantidad: videos },
      };
    }

    const informe = informeDeOrden(ot);
    if (informe) dto.informeX431 = informe;
    else if (idx === 0) dto.informeX431 = { pendiente: true };

    return dto;
  });

  // Garantía (señal discrecional): activa si no está cerrada y hay PDF/estado activo
  const ordenadas = [...gars].sort(
    (a, b) =>
      (numeroDe(b.fields?.['📅 Fecha de garantía']) ?? numeroDe(b.fields?.['Fecha entrega']) ?? 0) -
      (numeroDe(a.fields?.['📅 Fecha de garantía']) ?? numeroDe(a.fields?.['Fecha entrega']) ?? 0),
  );
  let garantia = { activa: false, whatsappUrl: waGarantia(placa) };
  const g = ordenadas[0]?.fields ?? null;
  if (g) {
    const estado = textoDe(g['Estado']).trim();
    const activa =
      !/cerrada/i.test(estado) &&
      (g['✅ PDF generado'] === true || /activa|revisar|revisada/i.test(estado));
    if (activa) {
      garantia = {
        activa: true,
        estado: estado || undefined,
        desde: aISO(numeroDe(g['📅 Fecha de garantía']) ?? numeroDe(g['Fecha entrega'])) || undefined,
        ref: textoDe(g['# GAR']).trim() ? `GAR-${textoDe(g['# GAR']).trim()}` : undefined,
        vigencia: textoDe(g['Vigencia']).trim() || undefined,
        whatsappUrl: waGarantia(placa),
      };
    }
  }

  const vehiculo = {
    marcaModelo:
      textoDe(vehiculoBase?.['Marca / Modelo']).trim() ||
      textoDe(ordenes[0]?.f?.['Marca/Modelo (recepción)']).trim(),
    ano: numeroDe(vehiculoBase?.['Año']),
    color: textoDe(vehiculoBase?.['Color']).trim() || undefined,
    vin: textoDe(vehiculoBase?.['VIN']).trim() || undefined,
    kmUltimaVisita: numeroDe(vehiculoBase?.['Km última visita']),
    totalOTs: linkIdsDe(vehiculoBase?.['OTs del vehículo']).length || ordenesDto.length,
  };

  return {
    placa,
    actualizado: new Date().toISOString(),
    vehiculo,
    ordenes: ordenesDto,
    garantia,
  };
}
