/**
 * Núcleo compartido del Portal de Consulta — Sprint 0.
 *
 * Reglas de oro (no negociables):
 *   1. SOLO LECTURA contra Lark Open API: auth, records/search y medias.
 *      Cero escrituras, cero uploads, cero mensajes, cero cambios de esquema.
 *   2. Sin estado compartido con el worker de garantías (otro proyecto y otros endpoints).
 *   3. Los secretos viven en variables de entorno de Vercel, nunca en el repo.
 *   4. Se reutiliza la misma app de Lark del taller (el mismo "bot" del worker).
 */

const LARK = 'https://open.larksuite.com';

/** Base "Jsan Taller" (la misma que usa el worker). */
export const BASE_TOKEN = process.env.LARK_BASE_TOKEN || 'Cr8mbXMAQaWH7nsyykbuCQBytab';

/** Tablas relevantes para el expediente (IDs internos de la Base). */
export const TABLAS = {
  vehiculos: 'tbljERpbywCIXBL8', // 🚗 Vehículos
  ordenes: 'tbl1ay4M7RDyhxet', // 📋 Órdenes de Trabajo
  recepcion: 'tbls5438JO9EoxZu', // 📥 Entradas Recepción
  diagnosticos: 'tblOXCdYdWpdW4F9', // 🔍 Diagnósticos
  garantias: 'tblBaCVbbmV1whtq', // 🛡️ Garantías
};

/* ─────────────────────────────── Autenticación ─────────────────────────────── */

let cacheToken = { valor: '', expira: 0 };
let tokenEnVuelo = null;

/** Pide un token nuevo al API de Lark (interno). */
async function pedirToken() {
  const res = await fetch(`${LARK}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Lark auth (${data.code ?? res.status}): ${data.msg ?? 'sin detalle'}`);
  }
  const segundos = Math.max(60, (Number(data.expire) || 7200) - 300);
  cacheToken = { valor: data.tenant_access_token, expira: Date.now() + segundos * 1000 };
  return cacheToken.valor;
}

/**
 * tenant_access_token del bot con caché de módulo (mientras viva la instancia).
 * Concurrency-safe: si varias búsquedas piden token a la vez, comparten la
 * misma petición en vuelo (evita pedir N tokens en paralelo).
 */
export async function getTenantToken() {
  if (cacheToken.valor && Date.now() < cacheToken.expira) return cacheToken.valor;
  if (!tokenEnVuelo) {
    tokenEnVuelo = pedirToken().finally(() => {
      tokenEnVuelo = null;
    });
  }
  return tokenEnVuelo;
}

/* ──────────────────────────── Normalización de placa ───────────────────────── */

/** Misma normalización que la fórmula `Placa Norm` de Lark. */
export function normalizarPlaca(entrada) {
  return String(entrada ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function placaValida(placa) {
  return /^[A-Z0-9]{5,8}$/.test(placa);
}

/** Condición de búsqueda por placa normalizada (formula field de Lark). */
export const porPlacaNorm = (placa) => [
  { field_name: 'Placa Norm', operator: 'is', value: [placa] },
];

/* ───────────────────────────── Lectura de la Base ──────────────────────────── */

export async function buscarRegistros(tableId, conditions, { pageSize = 100, sort, maxPaginas = 5 } = {}) {
  const token = await getTenantToken();
  const cuerpo = {};
  if (Array.isArray(conditions) && conditions.length > 0) {
    cuerpo.filter = { conjunction: 'and', conditions };
  }
  if (sort) cuerpo.sort = sort;

  const url = (query) =>
    LARK + '/open-apis/bitable/v1/apps/' + BASE_TOKEN + '/tables/' + tableId + '/records/search?' + query;
  const opciones = {
    method: 'POST', // lectura con filtro en el body (API de Búsqueda de registros)
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  };

  // Reintento único ante frecuencia (429 · code 99991400): espera el reset que
  // indica Lark (acotado a 2 s para no acercarse al maxDuration de la función).
  const pedir = async (query) => {
    let res = await fetch(url(query), opciones);
    let data = await res.json().catch(() => ({}));
    if (res.status === 429 || data.code === 99991400) {
      const reset = Number(res.headers?.get?.('x-ogw-ratelimit-reset')) || 1;
      await new Promise((r) => setTimeout(r, Math.min(reset, 2) * 1000));
      res = await fetch(url(query), opciones);
      data = await res.json().catch(() => ({}));
    }
    return { res, data };
  };

  // Paginación completa con tope de seguridad (hoy los volúmenes entran en 1 página).
  const items = [];
  let pageToken = '';
  for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
    const query = 'page_size=' + pageSize + (pageToken ? '&page_token=' + encodeURIComponent(pageToken) : '');
    const { res, data } = await pedir(query);
    if (!res.ok || data.code !== 0) {
      throw new Error('Lark search ' + tableId + ' (' + (data.code ?? res.status) + '): ' + (data.msg ?? 'sin detalle'));
    }
    items.push(...(data.data?.items ?? []));
    if (!data.data?.has_more || !data.data?.page_token) break;
    pageToken = data.data.page_token;
  }
  return { items, hasMore: false };
}

/* ────────────────────── Helpers de valores de campo de Lark ────────────────── */
/* La API devuelve formas distintas según el tipo de campo:
   texto simple ("…"), segmentos ([{text,type}]), fórmula de texto ({type,value:[…]}),
   fórmula numérica ({type,value:[0]}), números, links ({link_record_ids}) y
   select como string con el nombre de la opción.                              */

export function textoDe(valor) {
  if (valor == null) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') return String(valor);
  if (Array.isArray(valor)) return valor.map(textoDe).join('');
  if (typeof valor === 'object') {
    if (typeof valor.link === 'string') return valor.link; // campos URL ({ link, text })
    if (typeof valor.text === 'string' && valor.value === undefined) return valor.text;
    if (Array.isArray(valor.value)) return textoDe(valor.value);
    if (valor.value !== undefined) return textoDe(valor.value);
  }
  return '';
}

export function numeroDe(valor) {
  if (valor == null) return undefined;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (typeof valor === 'string') {
    const n = Number(valor);
    return Number.isFinite(n) ? n : undefined;
  }
  if (Array.isArray(valor)) return valor.length > 0 ? numeroDe(valor[0]) : undefined;
  if (typeof valor === 'object') return numeroDe(valor.value);
  return undefined;
}

/**
 * Kilómetros — los campos «Km última visita», «Km entrada» y «Km reportado»
 * llegan con DOS convenciones (verificado en la Base, 26-sep-2026):
 *   · enteros correctos:   269435, 132500, 97435…
 *   · con punto de miles:  221.532 (= 221 532 km), 249.688, 166.989, 325.722…
 * Los km son enteros, así que un número con exactamente 3 decimales es una
 * captura con separador de miles mal escrito (los vehículos de la Base tienen
 * entre 90 000 y 330 000 km). Se normaliza a entero.
 */
export function kmDe(valor) {
  const n = numeroDe(valor);
  if (n === undefined) return undefined;
  const conPuntoDeMiles = !Number.isInteger(n) && /\.\d{3}$/.test(String(n));
  return Math.round(conPuntoDeMiles ? n * 1000 : n);
}

export function linkIdsDe(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.flatMap(linkIdsDe);
  if (typeof valor === 'object') {
    if (Array.isArray(valor.link_record_ids)) return valor.link_record_ids;
    if (Array.isArray(valor.record_ids)) return valor.record_ids;
    if (typeof valor.id === 'string') return [valor.id];
  }
  return [];
}

/* ─────────────────────────── Firma de fotos (lectura) ──────────────────────── */

export const MAX_FIRMAS_POR_LOTE = 5; // verificado: 5/5 por llamada

/**
 * Firma file_tokens de adjuntos y devuelve un Map token → URL temporal (~24 h).
 * ⚠️ Lark exige parámetro REPETIDO: ?file_tokens=A&file_tokens=B
 *    (con comas separadas responde vacío — verificado en vivo).
 */
/* Caché de firmas en memoria del proceso: la URL temporal vive ~24 h y se
   reutiliza hasta 20 h. Evita volver a firmar las mismas fotos en cada fan-out
   (menos llamadas a Lark para todos los que abren el mismo expediente). */
const FIRMA_TTL_MS = 20 * 60 * 60 * 1000;
const cacheFirmas = new Map();

export async function firmarFotos(fileTokens = []) {
  const salida = new Map();
  const ahora = Date.now();
  const faltantes = [];

  for (const token of new Set(fileTokens.filter(Boolean))) {
    const guardada = cacheFirmas.get(token);
    if (guardada && guardada.expira > ahora) salida.set(token, guardada.url);
    else faltantes.push(token);
  }

  const lotes = [];
  for (let i = 0; i < faltantes.length; i += MAX_FIRMAS_POR_LOTE) {
    lotes.push(faltantes.slice(i, i + MAX_FIRMAS_POR_LOTE));
  }
  if (lotes.length === 0) return salida;

  const token = await getTenantToken();
  const respuestas = await Promise.all(
    lotes.map(async (lote) => {
      const query = lote.map((t) => 'file_tokens=' + encodeURIComponent(t)).join('&');
      const res = await fetch(
        LARK + '/open-apis/drive/v1/medias/batch_get_tmp_download_url?' + query,
        { headers: { Authorization: 'Bearer ' + token } },
      );
      const data = await res.json().catch(() => ({}));
      return res.ok && data.code === 0 ? (data.data?.tmp_download_urls ?? []) : [];
    }),
  );

  for (const items of respuestas) {
    for (const item of items) {
      if (item?.file_token && item?.tmp_download_url) {
        salida.set(item.file_token, item.tmp_download_url);
        cacheFirmas.set(item.file_token, { url: item.tmp_download_url, expira: ahora + FIRMA_TTL_MS });
      }
    }
  }

  if (cacheFirmas.size > 2000) {
    for (const [clave, valor] of cacheFirmas) {
      if (valor.expira <= ahora) cacheFirmas.delete(clave);
    }
  }
  return salida;
}

/* ───────────────────── Informe X431 (URL capturada en textos) ──────────────── */

const X431_URL = /https?:\/\/[^\s"'<>]*x431\.com[^\s"'<>]*/i;

/**
 * Busca la URL del informe X431 en cualquier campo de texto del diagnóstico.
 * Hoy el técnico la pega junto a los códigos en "DTCs / Errores computadora";
 * si mañana usan un campo dedicado, el escaneo por patrón lo detecta igual.
 */
export function extraerInformeX431(textos = []) {
  for (const texto of textos) {
    const encontrada = textoDe(texto).match(X431_URL)?.[0];
    if (!encontrada) continue;
    try {
      const url = new URL(encontrada);
      const informeId = url.searchParams.get('diagnose_record_id') ?? '';
      // Si el enlace no trae report_type, el informe X431 estándar es X2.
      const reportType = url.searchParams.get('report_type') ?? 'X2';
      if (informeId) return { informeId, reportType, url: encontrada };
    } catch {
      /* seguimos con el próximo texto */
    }
  }
  return null;
}

/* ─────────────────────────────── Fechas / formato ──────────────────────────── */

const TZ = 'America/Caracas';

export function aISO(ms) {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : '';
}

export function fmtFecha(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(n));
}

export function fmtFechaHora(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(n));
}

/* ─────────────────────── Seguro anti-mapeo (ver nota) ───────────────────────── */
/**
 * La convención de guion bajo excluye este archivo como endpoint de Vercel.
 * Este export inofensivo existe solo por si el builder cambiara de criterio:
 * en tal caso respondería 404 en lugar de romper el despliegue.
 */
export default function noEsEndpoint(_req, res) {
  res.status(404).json({ ok: false, error: 'not_found' });
}
