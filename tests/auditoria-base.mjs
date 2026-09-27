/**
 * Auditoría de la Base Lark vs el código del Portal (solo lectura).
 *
 * Uso:
 *   set -a && . /Users/angelpenalver/orca/workspaces/Jsan/Lark/.env.local && set +a
 *   node tests/auditoria-base.mjs
 *
 * Verifica:
 *  1. Que los campos que usa el código existan en la Base (drift de esquema).
 *  2. Cobertura del enlace del informe X431 en Diagnósticos (dónde se pega).
 *  3. Estados reales de OT y de Garantías (mapeo del tracker/señal).
 *  4. Inventario de adjuntos de Recepción (imágenes vs videos).
 *
 * Falla (exit 1) solo si falta un campo esperado; el resto es informativo.
 */
import { readFileSync } from 'node:fs';

const envFile = readFileSync('/Users/angelpenalver/orca/workspaces/Jsan/Lark/.env.local', 'utf8');
for (const line of envFile.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

const { BASE_TOKEN, TABLAS, getTenantToken, buscarRegistros, textoDe, extraerInformeX431 } = await import(
  '../api/_lib/expediente.js'
);
const LARK = 'https://open.larksuite.com';

const ESPERADOS = {
  vehiculos: ['Placa Norm', 'Marca / Modelo', 'Año', 'Color', 'VIN', 'Km última visita', 'OTs del vehículo'],
  ordenes: ['# OT', 'Placa Norm', 'Estado', '📅 Fecha ingreso', 'Km entrada', 'Síntoma reportado', 'Fecha entrega', 'Marca/Modelo (recepción)'],
  recepcion: ['🔢 N° entrada', '📅 Fecha', 'Placa Norm', 'Km reportado', '¿Qué le pasa al carro?', 'Fotos'],
  diagnosticos: ['📅 Fecha', 'Placa Norm', 'OT vinculada', 'DTCs / Errores computadora', 'Relato completo del diagnóstico', '🔧 Hallazgos del desmontaje'],
  garantias: ['# GAR', 'Placa', 'Estado', '📅 Fecha de garantía', 'Fecha entrega', '✅ PDF generado', 'Vigencia', 'OT'],
};

let fallos = 0;
console.log('== 1. MAPEO DE CAMPOS (codigo vs Base real) ==');
for (const [tabla, esperados] of Object.entries(ESPERADOS)) {
  const token = await getTenantToken();
  const res = await fetch(
    LARK + '/open-apis/bitable/v1/apps/' + BASE_TOKEN + '/tables/' + TABLAS[tabla] + '/fields?page_size=200',
    { headers: { Authorization: 'Bearer ' + token } },
  );
  const data = await res.json().catch(() => ({}));
  const reales = (data.data?.items ?? []).map((f) => f.field_name);
  const faltan = esperados.filter((e) => !reales.includes(e));
  console.log('* ' + tabla + ': ' + reales.length + ' campos · faltan: ' + (faltan.length ? JSON.stringify(faltan) : 'ninguno'));
  if (faltan.length) fallos += faltan.length;
}

console.log('\n== 2. X431 EN DIAGNOSTICOS ==');
const dx = await buscarRegistros(TABLAS.diagnosticos, [], { pageSize: 500, maxPaginas: 4 });
let conUrl = 0;
for (const it of dx.items) {
  if (extraerInformeX431(Object.values(it.fields ?? {}).map(textoDe))) conUrl += 1;
}
console.log('registros: ' + dx.items.length + ' · con URL de informe: ' + conUrl);

console.log('\n== 3. ESTADOS REALES ==');
const ots = await buscarRegistros(TABLAS.ordenes, [], { pageSize: 500, maxPaginas: 4 });
const estados = new Map();
for (const it of ots.items) {
  const e = textoDe(it.fields?.['Estado']).trim() || '(vacio)';
  estados.set(e, (estados.get(e) ?? 0) + 1);
}
console.log('OT: ' + JSON.stringify(Object.fromEntries(estados)));
const gar = await buscarRegistros(TABLAS.garantias, [], { pageSize: 200 });
const estadosGar = new Map();
for (const it of gar.items) {
  const e = textoDe(it.fields?.['Estado']).trim() || '(vacio)';
  estadosGar.set(e, (estadosGar.get(e) ?? 0) + 1);
}
console.log('Garantias: ' + JSON.stringify(Object.fromEntries(estadosGar)));

console.log('\n== 4. ADJUNTOS DE RECEPCION ==');
const rec = await buscarRegistros(TABLAS.recepcion, [], { pageSize: 500, maxPaginas: 4 });
let imagenes = 0;
let videos = 0;
for (const it of rec.items) {
  for (const a of it.fields?.['Fotos'] ?? []) {
    const tipo = String(a?.type ?? '');
    if (tipo.startsWith('image/')) imagenes += 1;
    else if (tipo.startsWith('video/')) videos += 1;
  }
}
console.log('registros: ' + rec.items.length + ' · imagenes: ' + imagenes + ' · videos: ' + videos);

console.log(fallos === 0 ? '\nAUDITORIA: OK (sin drift de campos)' : '\nAUDITORIA: ' + fallos + ' campos faltantes');
process.exit(fallos === 0 ? 0 : 1);
