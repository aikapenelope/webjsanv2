/**
 * Smoke del embed de recepción (sin gate): verifica en el build que el
 * formulario se embebe directo con las optimizaciones vigentes.
 *
 * Uso:
 *   npm run build && node tests/recepcion-smoke.mjs
 */
import { existsSync, readFileSync } from 'node:fs';

const repo = new URL('..', import.meta.url).pathname;
const ruta = `${repo}/dist/recepcion/index.html`;

if (!existsSync(ruta)) {
  console.error('FALLO no existe dist/recepcion/index.html (corre npm run build antes)');
  process.exit(1);
}

const html = readFileSync(ruta, 'utf8');
const comprobaciones = [
  ['fachada con botón de carga diferida', html.includes('data-lazy-embed-load')],
  [
    'iframe diferido con la URL del formulario',
    /data-src="https:\/\/[^"]*larksuite\.com\/share\/base\/form\//.test(html),
  ],
  ['timeout amable activo', html.includes('data-timeout-soft="true"')],
  [
    'preconnect al host del formulario',
    /rel="preconnect"[^>]*larksuite\.com/.test(html),
  ],
  ['sandbox con storage access', html.includes('allow-storage-access-by-user-activation')],
  ['sin puerta de verificación (gate retirado)', !html.includes('data-recepcion-gate')],
];

let fallos = 0;
for (const [etiqueta, ok] of comprobaciones) {
  if (!ok) fallos += 1;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${etiqueta}`);
}

console.log('\nPruebas: ' + comprobaciones.length + ' · Fallos: ' + fallos);
console.log(fallos === 0 ? 'TODO VERDE' : 'HAY FALLOS');
process.exit(fallos === 0 ? 0 : 1);
