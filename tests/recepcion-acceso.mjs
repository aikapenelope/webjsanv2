/**
 * Pruebas del blindaje del formulario de recepción (Sprint A) — sin red real.
 *
 * Uso:
 *   npm run build && node tests/recepcion-acceso.mjs
 *
 * · Mockea la llamada a Cloudflare Turnstile (respuesta controlada, sin tocar red).
 * · Prueba /api/recepcion-acceso: token ausente/rechazado/válido, rate-limit,
 *   sin configuración, y que la URL entregada sea la oficial (absoluta y de Lark).
 * · Smoke del build: dist/recepcion/index.html NO debe contener la URL de Lark.
 */
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const repo = new URL('..', import.meta.url).pathname;
const FORM_URL = 'https://taller-de-prueba.larksuite.com/share/base/form/form-de-prueba';
const SECRETO_PRUEBA = '1x0000000000000000000000000000000AA'; // clave de prueba de Cloudflare

process.env.LARK_FORM_URL = FORM_URL;
process.env.TURNSTILE_SECRET_KEY = SECRETO_PRUEBA;

// Mock de Cloudflare Turnstile: el token "bloqueado" siempre falla.
globalThis.fetch = async (url, opciones = {}) => {
  const destino = String(url);
  if (destino.includes('challenges.cloudflare.com/turnstile/v0/siteverify')) {
    const params = new URLSearchParams(String(opciones.body ?? ''));
    const exito = Boolean(params.get('secret')) && params.get('response') !== 'bloqueado';
    return new Response(
      JSON.stringify(
        exito ? { success: true } : { success: false, 'error-codes': ['invalid-input-response'] },
      ),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  throw new Error('fetch inesperado en pruebas: ' + destino);
};

const { default: acceso } = await import(pathToFileURL(`${repo}/api/recepcion-acceso.js`).href);

function mockRes() {
  return {
    code: 0,
    body: null,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    status(c) {
      this.code = c;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
  };
}

let contadorIp = 0;
async function pedir(handler, consulta, { method = 'GET', ip } = {}) {
  const req = {
    method,
    url: `/api/prueba?${consulta}`,
    query: {},
    headers: { 'x-real-ip': ip ?? `ip-prueba-${++contadorIp}` },
  };
  const res = mockRes();
  await handler(req, res);
  return res;
}

let pasan = 0;
let fallan = 0;
function comprobar(condicion, etiqueta) {
  if (condicion) {
    pasan += 1;
    console.log('OK    ' + etiqueta);
  } else {
    fallan += 1;
    console.log('FALLO ' + etiqueta);
  }
}

// ── 1-6 · /api/recepcion-acceso ─────────────────────────────────────────────
let r = await pedir(acceso, '');
comprobar(r.code === 400 && r.body?.error === 'token_ausente', 'acceso sin token → 400 token_ausente');

r = await pedir(acceso, 'token=bloqueado');
comprobar(
  r.code === 403 && r.body?.error === 'verificacion_fallida',
  'token rechazado por Turnstile → 403 verificacion_fallida',
);

r = await pedir(acceso, 'token=valido');
comprobar(
  r.code === 200 && r.body?.ok === true && r.body?.url === FORM_URL,
  'token válido → 200 con la URL oficial del formulario',
);
comprobar(
  typeof r.body?.url === 'string' && /^https:\/\/[^\s]*larksuite\.com\//.test(r.body.url),
  'la URL entregada es absoluta y de larksuite.com',
);
comprobar(r.headers['cache-control'] === 'no-store', 'acceso responde no-store');

r = await pedir(acceso, 'token=valido', { method: 'POST' });
comprobar(r.code === 405, 'acceso con POST → 405');

// ── 7 · rate-limit (misma IP) ───────────────────────────────────────────────
const ipFija = 'ip-rate-limit';
let ultimo;
for (let i = 0; i < 12; i += 1) {
  ultimo = await pedir(acceso, 'token=valido', { ip: ipFija });
}
comprobar(ultimo.code === 429, 'más de 10 pedidos por minuto desde una IP → 429');

// ── 8 · sin configuración ───────────────────────────────────────────────────
delete process.env.TURNSTILE_SECRET_KEY;
r = await pedir(acceso, 'token=valido');
comprobar(r.code === 503 && r.body?.error === 'no_configurado', 'sin TURNSTILE_SECRET_KEY → 503 no_configurado');
process.env.TURNSTILE_SECRET_KEY = SECRETO_PRUEBA;

delete process.env.LARK_FORM_URL;
r = await pedir(acceso, 'token=valido');
comprobar(r.code === 503 && r.body?.error === 'no_configurado', 'sin LARK_FORM_URL → 503 no_configurado');
process.env.LARK_FORM_URL = FORM_URL;

// ── 9 · smoke del HTML compilado ────────────────────────────────────────────
const htmlRuta = `${repo}/dist/recepcion/index.html`;
if (!existsSync(htmlRuta)) {
  fallan += 1;
  console.log('FALLO no existe dist/recepcion/index.html (corre npm run build antes)');
} else {
  const html = readFileSync(htmlRuta, 'utf8');
  comprobar(
    !html.includes('larksuite') && !html.includes('/share/base/form'),
    'el HTML de /recepcion/ no contiene la URL del formulario',
  );
  comprobar(
    html.includes('data-recepcion-gate') && html.includes('data-recepcion-gate-start'),
    'el HTML trae la puerta de verificación',
  );
  comprobar(html.includes('data-timeout-soft="true"'), 'el embed usa timeout amable (no descarta la carga)');
}

console.log('\nPruebas: ' + (pasan + fallan) + ' · Fallos: ' + fallan);
console.log(fallan === 0 ? 'TODO VERDE' : 'HAY FALLOS');
process.exit(fallan === 0 ? 0 : 1);
