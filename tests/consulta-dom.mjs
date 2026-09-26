/**
 * Pruebas de runtime del Portal de Consulta — ejecuta el bundle REAL compilado
 * (`dist/_astro/consulta…js`) dentro de jsdom y verifica el DOM resultante
 * contra datos REALES de la Base de Lark.
 *
 * Cómo correr (no agrega dependencias al sitio; jsdom se instala aparte):
 *   mkdir -p /tmp/cqdom && npm install --prefix /tmp/cqdom jsdom
 *   cd /Users/angelpenalver/orca/workspaces/Jsan/WEB-version-clara
 *   npm run build
 *   set -a && . /Users/angelpenalver/orca/workspaces/Jsan/Lark/.env.local && set +a
 *   node tests/consulta-dom.mjs
 *
 * Variables: JSDOM_PATH (ruta alternativa a jsdom), PLACA_COMPLETA/PLACA_MEDIA.
 * 100% lectura: solo llama al fanout (Lark) para armar los payloads.
 */
const rutaJsdom = process.env.JSDOM_PATH || '/tmp/cqdom/node_modules/jsdom/lib/api.js';

let JSDOM;
try {
  ({ JSDOM } = await import(rutaJsdom));
} catch {
  console.error('❌ Falta jsdom. Instálalo aparte (sin tocar el package.json del sitio):');
  console.error('   mkdir -p /tmp/cqdom && npm install --prefix /tmp/cqdom jsdom');
  console.error('   o exporta JSDOM_PATH=/ruta/a/jsdom/lib/api.js');
  process.exit(2);
}

const { readFile, readdir } = await import('node:fs/promises');
const { pathToFileURL } = await import('node:url');
const { construirExpediente } = await import('../api/_lib/fanout.js');

const DIST = new URL('../dist/', import.meta.url).pathname;
const PLACA_COMPLETA = process.env.PLACA_COMPLETA || 'AE473LM';
const PLACA_MEDIA = process.env.PLACA_MEDIA || 'AG868ZA';

if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) {
  console.error('❌ Faltan las credenciales LARK_* (exporta el .env.local del workspace Jsan/Lark).');
  process.exit(2);
}

let html;
try {
  html = await readFile(`${DIST}consulta/index.html`, 'utf8');
} catch {
  console.error(`❌ No encontré ${DIST}consulta/index.html — corre "npm run build" primero.`);
  process.exit(2);
}

const archivos = await readdir(`${DIST}_astro`);
const bundle = archivos.find(
  (f) => f.startsWith('consulta.astro_astro_type_script_index_0_lang') && f.endsWith('.js'),
);
if (!bundle) {
  console.error('❌ No encontré el bundle compilado de /consulta/.');
  process.exit(2);
}

/** Payload real del API para una placa (falla si la data de prueba ya no existe). */
async function payloadDe(placa, { conInforme } = {}) {
  const exp = await construirExpediente(placa);
  if (!exp) throw new Error(`La placa ${placa} no existe en la Base (¿cambió la data de prueba?)`);
  if (conInforme) {
    exp.ordenes[0].informeX431 = {
      informeId: '3323e370ge8c54nRoGAEDhnRLr',
      reportType: 'X2',
      url: 'https://usait.x431.com/Home/Report/index?diagnose_record_id=3323e370ge8c54nRoGAEDhnRLr&report_type=X2',
    };
  }
  return { ok: true, encontrado: true, ...exp };
}

/** Forma exacta que devuelve /api/x431 (verificada contra el informe real). */
const X431 = {
  ok: true,
  informe: {
    informeId: '3323e370ge8c54nRoGAEDhnRLr',
    reportType: 'X2',
    reportCode: 'X20036690627',
    fecha: '2026-09-25T20:03:01.000Z',
    tester: 'Jhon Sanjuanelo',
    vehiculo: 'Toyota Corolla',
    duracionSeg: 85,
    totalSistemas: 9,
    totalFallas: 1,
    sistemas: [
      {
        nombre: 'Transmisión',
        fallas: [
          {
            codigo: 'P2714',
            descripcion: 'Pressure Control Solenoid D Performance',
            estado: 'Confirmed',
          },
        ],
      },
    ],
    sistemasOk: ['ABS', 'Airbag', 'Motor'],
  },
};

const expCompleto = await payloadDe(PLACA_COMPLETA);
const expMedia = await payloadDe(PLACA_MEDIA, { conInforme: true });

const fallos = [];
let total = 0;

function crearEntorno(payloadExpediente, url, falla) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  const { window } = dom;

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.location = window.location;
  globalThis.history = window.history;
  globalThis.localStorage = window.localStorage;
  try {
    Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  } catch {
    /* Node ≥21 define navigator sin setter */
  }
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Event = window.Event;
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.matchMedia = globalThis.matchMedia;

  class ObservadorFalso {
    constructor(cb) {
      this.cb = cb;
    }
    observe(el) {
      this.cb([{ isIntersecting: true, target: el }], this);
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = ObservadorFalso;
  window.IntersectionObserver = ObservadorFalso;

  window.Element.prototype.scrollIntoView = function () {};
  window.Element.prototype.scrollTo = function () {};

  globalThis.fetch = async (urlPedida) => {
    if (falla === 'red') throw new TypeError('Failed to fetch');
    if (falla === 'limite') {
      return {
        ok: false,
        status: 429,
        headers: { get: (h) => (String(h).toLowerCase() === 'retry-after' ? '17' : null) },
        json: async () => ({}),
      };
    }
    const u = String(urlPedida);
    if (u.includes('/api/x431')) {
      globalThis.__x431Llamadas = (globalThis.__x431Llamadas ?? 0) + 1;
    }
    // Un escenario puede simular una segunda búsqueda con otro resultado por placa.
    const porPlaca = globalThis.__payloadPorPlaca ?? {};
    const placaPedida = Object.keys(porPlaca).find((p) => u.includes(`placa=${p}`));
    const cuerpo = u.includes('/api/expediente')
      ? (placaPedida ? porPlaca[placaPedida] : payloadExpediente)
      : X431;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => JSON.parse(JSON.stringify(cuerpo)),
    };
  };
  window.fetch = globalThis.fetch;

  return dom;
}

const texto = (window, sel) => window.document.querySelector(sel)?.textContent?.trim() ?? '';
const visible = (window, sel) => window.document.querySelector(sel)?.hidden === false;

function evaluar(nombre, comprobaciones, window) {
  for (const [etiqueta, fn] of comprobaciones) {
    total += 1;
    let ok = false;
    let detalle = '';
    try {
      const valor = fn();
      ok = valor === true;
      detalle = typeof valor === 'string' ? valor : '';
    } catch (err) {
      detalle = `error: ${err?.message ?? err}`;
    }
    if (!ok) fallos.push(`${nombre} · ${etiqueta}${detalle ? ` (${detalle})` : ''}`);
    console.log(`  ${ok ? '✅' : '❌'} ${etiqueta}${detalle ? ` — ${detalle}` : ''}`);
    void window;
  }
}

async function correr(nombre, { expediente, url, revision, extra, falla }) {
  const dom = crearEntorno(expediente, url, falla);
  const { window } = dom;
  globalThis.__x431Llamadas = 0;
  globalThis.__payloadPorPlaca = undefined;

  await import(
    `${pathToFileURL(`${DIST}_astro/${bundle}`).href}?escenario=${encodeURIComponent(nombre)}`
  );
  window.document.dispatchEvent(new window.Event('astro:page-load'));
  await new Promise((r) => setTimeout(r, 350));

  console.log(`\n══ ${nombre} ══`);
  evaluar(nombre, revision(window), window);
  if (extra) {
    await new Promise((r) => setTimeout(r, 200));
    evaluar(nombre, await extra(window), window);
  }
  window.close();
}

/* ── A. Expediente más completo de la Base (deep-link) ────────────────────── */
const ordenA = expCompleto.ordenes[0];
const fotosA = ordenA?.recepcion?.fotos?.length ?? 0;
const garantiaA = expCompleto.garantia;

await correr('A · expediente completo (deep-link)', {
  expediente: expCompleto,
  url: `https://hidromaticosjsan.com/consulta/?placa=${PLACA_COMPLETA}`,
  revision: (window) => [
    ['tarjeta de vehículo visible', () => visible(window, '#cq-vehiculo')],
    ['título con la placa', () => texto(window, '#cq-resultado-titulo').includes(PLACA_COMPLETA)],
    ['placa en la matrícula', () => texto(window, '#cq-vehiculo [data-campo="placa"]') === PLACA_COMPLETA],
    [
      'kilómetros sin decimales (formato de miles)',
      () => /^\d{1,3}(\.\d{3})+ km$/.test(texto(window, '#cq-vehiculo [data-campo="km"]')) || 'km vacío (sin dato)',
    ],
    ['tracker visible', () => visible(window, '#cq-tracker')],
    ['nro de OT en el tracker', () => /\d/.test(texto(window, '#cq-tracker [data-campo="nroOT"]'))],
    [
      'etapa actual coherente con el API',
      () => {
        const etapa = ordenA.etapa;
        if (etapa < 0) return window.document.querySelector('#cq-banner').hidden === false;
        return (
          window.document.querySelector(`#cq-pasos li[data-paso="${etapa}"]`).classList.contains('is-current') &&
          [...window.document.querySelectorAll('#cq-pasos li.is-done')].length === etapa
        );
      },
    ],
    ['pie del tracker con fecha de ingreso', () => texto(window, '#cq-tracker [data-campo="pie"]').includes('Ingresó el')],
    [
      'ficha de recepción coherente con el DTO',
      () =>
        window.document.querySelector('#cq-recep-ficha').hidden === !ordenA?.recepcion &&
        window.document.querySelector('#cq-recep-vacio').hidden === Boolean(ordenA?.recepcion),
    ],
    [`${fotosA} slides en el carrusel`, () => window.document.querySelectorAll('#cq-fotos-track .cq-slide').length === fotosA],
    [`contador 1/${fotosA}`, () => texto(window, '#cq-fotos [data-campo="contador"]') === `1/${fotosA}`],
    [`${fotosA} puntos de progreso`, () => window.document.querySelectorAll('#cq-fotos-dots .cq-dot').length === fotosA],
    ['primera imagen con URL firmada', () => (window.document.querySelector('#cq-fotos-track img')?.src ?? '').startsWith('https://')],
    ['alt descriptivo con la placa', () => (window.document.querySelector('#cq-fotos-track img')?.alt ?? '').includes(PLACA_COMPLETA)],
    [
      'avisos de medios coherentes con el DTO',
      () => {
        const videos = ordenA?.recepcion?.videos?.cantidad ?? 0;
        const sinAcceso = ordenA?.recepcion?.fotosSinAcceso ?? 0;
        return (
          window.document.querySelector('#cq-aviso-video').hidden === (videos === 0) &&
          window.document.querySelector('#cq-aviso-fotos').hidden === (sinAcceso === 0)
        );
      },
    ],
    ['historial con tarjetas', () => window.document.querySelectorAll('#cq-hist-lista .cq-hist-card').length === expCompleto.ordenes.length],
    ['primera tarjeta marcada como visita actual', () => texto(window, '#cq-hist-lista .cq-hist-badge') === 'Visita actual'],
    [
      'garantía coherente con el DTO',
      () =>
        visible(window, garantiaA.activa ? '#cq-garantia-activa' : '#cq-garantia-inactiva') &&
        window.document.querySelector(garantiaA.activa ? '#cq-garantia-inactiva' : '#cq-garantia-activa').hidden === true,
    ],
    ['pie "Actualizado …"', () => texto(window, '#cq-tabs [data-campo="actualizado"]').startsWith('Actualizado')],
    ['deep-link conservado en la URL', () => window.location.search.includes(`placa=${PLACA_COMPLETA}`)],
    ['visor oculto al inicio', () => window.document.querySelector('#cq-visor').hidden === true],
    [
      'abrir visor desde la primera foto',
      () => {
        window.document.querySelector('#cq-fotos-track .cq-slide-btn').click();
        return (
          window.document.querySelector('#cq-visor').hidden === false &&
          texto(window, '#cq-visor [data-campo="contador"]') === `1/${fotosA}`
        );
      },
    ],
    ['visor con la imagen firmada', () => (window.document.querySelector('#cq-visor-img')?.src ?? '').startsWith('https://')],
    ['visor bloquea el scroll del documento', () => window.document.documentElement.style.overflow === 'hidden'],
    [
      'cerrar visor restaura el scroll',
      () => {
        window.document.querySelector('#cq-visor [data-accion="cerrar"]').click();
        return (
          window.document.querySelector('#cq-visor').hidden === true &&
          window.document.documentElement.style.overflow === ''
        );
      },
    ],
    [
      'pestaña Historial activa su panel',
      () => {
        window.document.getElementById('cq-tab-historial').click();
        return (
          window.document.getElementById('cq-panel-historial').hidden === false &&
          window.document.getElementById('cq-panel-recepcion').hidden === true &&
          window.document.getElementById('cq-tab-historial').getAttribute('aria-selected') === 'true'
        );
      },
    ],
    [
      'informe X431 coherente con el DTO',
      () => {
        window.document.getElementById('cq-tab-x431').click();
        const ref = ordenA?.informeX431;
        const tieneInforme = Boolean(ref && 'informeId' in ref);
        return tieneInforme
          ? window.document.getElementById('cq-x431-vacio').hidden === true
          : visible(window, '#cq-x431-vacio');
      },
    ],
    [
      'sin informe: no se ofrece el iframe diferido',
      () => {
        const ref = ordenA?.informeX431;
        const tieneInforme = Boolean(ref && 'informeId' in ref);
        return window.document.getElementById('cq-x431-embed').hidden === !tieneInforme;
      },
    ],
  ],
});

/* ── B. Videos + fotos sin acceso + informe X431 en diferido ───────────────── */
const ordenB = expMedia.ordenes[0];
const videosB = ordenB?.recepcion?.videos?.cantidad ?? 0;
const sinAccesoB = ordenB?.recepcion?.fotosSinAcceso ?? 0;

await correr('B · medios no accesibles + X431', {
  expediente: expMedia,
  url: 'https://hidromaticosjsan.com/consulta/?placa=ag-868-za',
  revision: (window) => [
    ['placa normalizada desde URL sucia', () => texto(window, '#cq-vehiculo [data-campo="placa"]') === PLACA_MEDIA],
    [
      'tracker en la etapa del DTO',
      () =>
        ordenB.etapa < 0 ||
        window.document.querySelector(`#cq-pasos li[data-paso="${ordenB.etapa}"]`).classList.contains('is-current'),
    ],
    ['ficha de recepción visible', () => window.document.querySelector('#cq-recep-ficha').hidden === false],
    ['nro de entrada presente', () => /\d/.test(texto(window, '#cq-recep-ficha [data-campo="nroEntrada"]'))],
    [
      `carrusel ${ordenB?.recepcion?.fotos?.length ? 'visible' : 'oculto'} según fotos firmables`,
      () => window.document.querySelector('#cq-fotos').hidden === ((ordenB?.recepcion?.fotos?.length ?? 0) === 0),
    ],
    [
      'aviso de VIDEO coherente con el DTO',
      () => window.document.querySelector('#cq-aviso-video').hidden === (videosB === 0),
    ],
    [
      'aviso de video menciona la cantidad',
      () => videosB === 0 || texto(window, '#cq-aviso-video [data-campo="titulo"]').includes(String(videosB)),
    ],
    [
      'WhatsApp de video con placa y entrada',
      () => {
        if (videosB === 0) return true;
        const href = decodeURIComponent(window.document.querySelector('#cq-aviso-video [data-campo="wa"]')?.href ?? '');
        return href.includes(PLACA_MEDIA) && href.includes('584141066546') && /entrada/i.test(href);
      },
    ],
    [
      'aviso de FOTOS sin acceso coherente con el DTO',
      () => window.document.querySelector('#cq-aviso-fotos').hidden === (sinAccesoB === 0),
    ],
    [
      'aviso de fotos menciona la cantidad',
      () => sinAccesoB === 0 || texto(window, '#cq-aviso-fotos [data-campo="titulo"]').includes(String(sinAccesoB)),
    ],
  ],
  extra: async (window) => {
    window.document.getElementById('cq-tab-x431').click();
    await new Promise((r) => setTimeout(r, 250));
    return [
      ['X431: estado OK visible', () => visible(window, '#cq-x431-ok')],
      ['X431: tester real del informe', () => texto(window, '#cq-x431 [data-campo="tester"]') === X431.informe.tester],
      ['X431: duración formateada', () => texto(window, '#cq-x431 [data-campo="duracion"]') === '1 min 25 s'],
      ['X431: total de sistemas', () => texto(window, '#cq-x431 [data-campo="sistemas"]') === String(X431.informe.totalSistemas)],
      ['X431: total de fallas', () => texto(window, '#cq-x431 [data-campo="fallas"]') === String(X431.informe.totalFallas)],
      ['X431: sistema con nombre', () => texto(window, '#cq-x431-sistemas').includes('Transmisión')],
      ['X431: chip con el código P2714', () => texto(window, '#cq-x431-sistemas .cq-falla-codigo') === 'P2714'],
      [
        'X431: los códigos sueltos llevan rótulo',
        () =>
          texto(window, '#cq-x431-sistemas .cq-x431-codigos-titulo') === 'Códigos detectados' &&
          window.document.querySelectorAll('#cq-x431-sistemas .cq-x431-codigos .cq-pill.is-falla').length > 0,
      ],
      ['X431: descripción de la falla', () => texto(window, '#cq-x431-sistemas .cq-falla-desc').includes('Pressure Control')],
      ['X431: sistemas sin fallas como pills', () => window.document.querySelectorAll('#cq-x431-ok-lista .cq-pill.is-ok').length === 3],
      ['X431: enlace al informe original', () => (window.document.querySelector('#cq-x431-original')?.href ?? '').includes('usait.x431.com')],
      [
        'X431: no vuelve a pedir el informe al reabrir la pestaña',
        () => {
          window.document.getElementById('cq-tab-historial').click();
          window.document.getElementById('cq-tab-x431').click();
          return globalThis.__x431Llamadas === 1;
        },
      ],
      [
        'iframe diferido: fachada sin red hasta que se pide',
        () => {
          const bloque = window.document.getElementById('cq-x431-embed');
          const marco = window.document.getElementById('cq-x431-embed-marco');
          const fachada = marco.querySelector('[data-lazy-embed-facade]');
          return (
            bloque.hidden === false &&
            marco.dataset.src.includes('usait.x431.com') &&
            marco.dataset.lazyEmbedState === 'idle' &&
            fachada.hidden === false &&
            marco.querySelector('iframe') === null
          );
        },
      ],
      [
        'iframe diferido: enlaces "abrir en pestaña" con la URL del informe',
        () =>
          (window.document.getElementById('cq-x431-embed-original')?.href ?? '').includes('usait.x431.com') &&
          (window.document.getElementById('cq-x431-embed-original-2')?.href ?? '').includes('usait.x431.com'),
      ],
      [
        'iframe diferido: se crea un solo iframe al pedirlo (doble clic incluido)',
        () => {
          const marco = window.document.getElementById('cq-x431-embed-marco');
          const boton = marco.querySelector('[data-lazy-embed-load]');
          boton.click();
          boton.click();
          const iframes = marco.querySelectorAll('iframe');
          return (
            iframes.length === 1 &&
            iframes[0].src.includes('usait.x431.com') &&
            marco.dataset.lazyEmbedState === 'loading'
          );
        },
      ],
      [
        'iframe diferido: al cargar, la fachada se oculta y se ve el marco',
        () => {
          const marco = window.document.getElementById('cq-x431-embed-marco');
          marco.querySelector('iframe').dispatchEvent(new window.Event('load'));
          return (
            marco.dataset.lazyEmbedState === 'loaded' &&
            marco.querySelector('[data-lazy-embed-facade]').hidden === true &&
            marco.querySelector('[data-lazy-embed-loading]').hidden === true &&
            marco.querySelector('[data-lazy-embed-slot]').hidden === false
          );
        },
      ],
    ];
  },
});

/* ── E. Cambio de placa: el iframe diferido se desarma y se remonta ────────── */
const informes = {
  uno: 'https://usait.x431.com/Home/Report/index?diagnose_record_id=3323e370ge8c54nRoGAEDhnRLr&report_type=X2',
  dos: 'https://usait.x431.com/Home/Report/index?diagnose_record_id=OTROINFORME0001&report_type=X2',
};
const expOtraPlaca = structuredClone(expCompleto); // sin otra llamada a Lark
expOtraPlaca.ordenes[0].informeX431 = { informeId: 'OTROINFORME0001', reportType: 'X2', url: informes.dos };

await correr('B2 · cambio de placa reinicia el iframe del informe', {
  expediente: expMedia,
  url: `https://hidromaticosjsan.com/consulta/?placa=${PLACA_MEDIA}`,
  revision: (window) => [
    ['placa inicial en pantalla', () => texto(window, '#cq-vehiculo [data-campo="placa"]') === PLACA_MEDIA],
    [
      'informe 1 montado como fachada (cero red)',
      () => {
        window.document.getElementById('cq-tab-x431').click();
        const marco = window.document.getElementById('cq-x431-embed-marco');
        return (
          window.document.getElementById('cq-x431-embed').hidden === false &&
          marco.dataset.src === informes.uno &&
          marco.dataset.lazyEmbedState === 'idle' &&
          marco.querySelector('iframe') === null
        );
      },
    ],
  ],
  extra: async (window) => {
    // Segunda búsqueda: otra placa con OTRO informe, sin haber cargado el iframe.
    globalThis.__payloadPorPlaca = { [PLACA_COMPLETA]: expOtraPlaca };
    const entrada = window.document.getElementById('cq-placa');
    entrada.value = PLACA_COMPLETA;
    window.document
      .getElementById('cq-buscador')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 400));

    const marco = window.document.getElementById('cq-x431-embed-marco');
    const trasBuscar = {
      placa: texto(window, '#cq-vehiculo [data-campo="placa"]'),
      resultado: window.document.querySelector('#cq-resultado').hidden === false,
      embedOculto: window.document.getElementById('cq-x431-embed').hidden,
      iframes: marco.querySelectorAll('iframe').length,
    };

    window.document.getElementById('cq-tab-x431').click();
    const trasReabrir = {
      src: marco.dataset.src,
      estado: marco.dataset.lazyEmbedState,
      iframes: marco.querySelectorAll('iframe').length,
    };

    const crearOriginal = window.document.createElement.bind(window.document);
    let creados = 0;
    window.document.createElement = (etiqueta, ...resto) => {
      if (String(etiqueta).toLowerCase() === 'iframe') creados += 1;
      return crearOriginal(etiqueta, ...resto);
    };

    // Timeout corto: si sobreviviera una escucha del informe anterior, borraría
    // el iframe bueno al dispararse.
    marco.dataset.timeoutMs = '80';
    const boton = marco.querySelector('[data-lazy-embed-load]');
    boton.click();
    boton.click();
    const trasClic = {
      creados,
      frames: [...window.document.querySelectorAll('iframe')].map((f) => f.src),
      estado: marco.dataset.lazyEmbedState,
    };

    await new Promise((r) => setTimeout(r, 300)); // > timeout de la escucha vieja
    const trasTimeout = {
      frames: window.document.querySelectorAll('iframe').length,
      estado: marco.dataset.lazyEmbedState,
      fachadaOculta: marco.querySelector('[data-lazy-embed-facade]').hidden,
      errorVisible: marco.querySelector('[data-lazy-embed-error]').hidden === false,
    };

    return [
      ['la segunda placa reemplaza el resultado', () => trasBuscar.placa === PLACA_COMPLETA && trasBuscar.resultado],
      ['el embed del informe anterior queda desarmado', () => trasBuscar.embedOculto === true && trasBuscar.iframes === 0],
      [
        'al reabrir la pestaña se monta el informe nuevo',
        () => trasReabrir.src === informes.dos && trasReabrir.estado === 'idle' && trasReabrir.iframes === 0,
      ],
      [
        'un solo iframe, del informe nuevo (sin escuchas del anterior)',
        () =>
          trasClic.creados === 1 &&
          trasClic.frames.length === 1 &&
          trasClic.frames[0].includes('OTROINFORME0001') &&
          trasClic.estado === 'loading',
      ],
      [
        'pasado el timeout el iframe nuevo sigue visible y sin error',
        () =>
          trasTimeout.frames === 1 &&
          trasTimeout.estado === 'loading' &&
          trasTimeout.fachadaOculta === true &&
          trasTimeout.errorVisible === false,
      ],
    ];
  },
});

/* ── B3. OT en curso: chip «días en taller» y banners del tracker ──────────── */
const diasB = ordenB?.diasEnTaller;

await correr('B3 · tracker en curso: días en taller y banners', {
  expediente: expMedia,
  url: `https://hidromaticosjsan.com/consulta/?placa=${PLACA_MEDIA}`,
  revision: (window) => [
    [
      'chip «días en taller» con el valor real del API',
      () =>
        typeof diasB === 'number' &&
        diasB > 0 &&
        window.document.querySelector('#cq-tracker [data-campo="dias"]').hidden === false &&
        texto(window, '#cq-tracker [data-campo="dias"]') ===
          `⏱ ${diasB} ${diasB === 1 ? 'día' : 'días'} en taller`,
    ],
    [
      'paso actual = el de la etapa del API',
      () =>
        window.document
          .querySelector(`#cq-pasos li[data-paso="${ordenB.etapa}"]`)
          ?.classList.contains('is-current') === true,
    ],
    [
      'pie con la fecha de ingreso',
      () => /ingres/i.test(texto(window, '#cq-tracker [data-campo="pie"]')),
    ],
    ['sin banner cuando la orden avanza normal', () => window.document.getElementById('cq-banner').hidden === true],
  ],
  extra: async (window) => {
    const buscarCon = async (etapa, estado) => {
      const clon = structuredClone(expMedia);
      clon.ordenes[0].etapa = etapa;
      clon.ordenes[0].estado = estado;
      globalThis.__payloadPorPlaca = { [PLACA_MEDIA]: clon };
      window.document
        .getElementById('cq-buscador')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 350));
      const banner = window.document.getElementById('cq-banner');
      return {
        visible: banner.hidden === false,
        texto: banner.textContent.trim(),
        cancelado: banner.classList.contains('is-cancelado'),
        diasOculto: window.document.querySelector('#cq-tracker [data-campo="dias"]').hidden === true,
      };
    };

    const imprevisto = await buscarCon(-2, '⚠️ Imprevisto');
    const cancelado = await buscarCon(-1, '❌ Cancelado');

    return [
      [
        'banner ⚠️ de imprevisto (sin estilo de cancelado)',
        () =>
          imprevisto.visible &&
          imprevisto.texto.startsWith('⚠️') &&
          /espera|imprevisto/i.test(imprevisto.texto) &&
          imprevisto.cancelado === false,
      ],
      [
        'banner ❌ de cancelado con su estilo propio',
        () =>
          cancelado.visible &&
          cancelado.texto.startsWith('❌') &&
          /cancelada/i.test(cancelado.texto) &&
          cancelado.cancelado === true,
      ],
      [
        'con imprevisto/cancelado no se muestran días en taller',
        () => imprevisto.diasOculto === true && cancelado.diasOculto === true,
      ],
    ];
  },
});

/* ── C. Placa inexistente ─────────────────────────────────────────────────── */
await correr('C · placa inexistente', {
  expediente: { ok: true, encontrado: false, placa: 'ZZ999ZZ', actualizado: new Date().toISOString() },
  url: 'https://hidromaticosjsan.com/consulta/?placa=ZZ999ZZ',
  revision: (window) => [
    ['estado "no encontrada" visible', () => visible(window, '#cq-noencontrada')],
    ['muestra la placa consultada', () => texto(window, '#cq-noencontrada [data-campo="placa"]') === 'ZZ999ZZ'],
    ['resultado oculto', () => window.document.querySelector('#cq-resultado').hidden === true],
    ['CTA a la planilla de recepción', () => Boolean(window.document.querySelector('#cq-noencontrada a[href*="larksuite.com"]'))],
    ['CTA de WhatsApp', () => Boolean(window.document.querySelector('#cq-noencontrada a[href*="wa.me"]'))],
  ],
});

/* ── D. Placa inválida (no debe llamar al API) ────────────────────────────── */
await correr('D · placa inválida', {
  expediente: { ok: false, error: 'nunca_deberia_llamarse' },
  url: 'https://hidromaticosjsan.com/consulta/?placa=ae47',
  revision: (window) => [
    ['estado de aviso visible', () => visible(window, '#cq-aviso')],
    ['título "Revisa la placa"', () => texto(window, '#cq-aviso [data-campo="titulo"]') === 'Revisa la placa'],
    ['input marcado inválido', () => window.document.getElementById('cq-placa').getAttribute('aria-invalid') === 'true'],
    ['sin botón de reintentar', () => window.document.getElementById('cq-reintentar').hidden === true],
    ['resultado oculto', () => window.document.querySelector('#cq-resultado').hidden === true],
  ],
});

/* ── E. Estado inicial (sin placa) ────────────────────────────────────────── */
await correr('E · estado inicial', {
  expediente: { ok: false, error: 'nunca_deberia_llamarse' },
  url: 'https://hidromaticosjsan.com/consulta/',
  revision: (window) => [
    ['bloque informativo visible', () => visible(window, '#cq-inicio')],
    ['4 tarjetas de pasos', () => window.document.querySelectorAll('#cq-inicio .cq-inicio-card').length === 4],
    ['resultado oculto', () => window.document.querySelector('#cq-resultado').hidden === true],
    ['skeleton oculto', () => window.document.querySelector('#cq-skeleton').hidden === true],
    ['zona sin aria-busy', () => window.document.getElementById('cq-zona').getAttribute('aria-busy') === 'false'],
    ['input vacío', () => window.document.getElementById('cq-placa').value === ''],
  ],
});

/* ── F. Límite de consultas (429) ─────────────────────────────────────────── */
await correr('F · límite 429 del API', {
  expediente: { ok: false, error: 'demasiadas_solicitudes' },
  url: `https://hidromaticosjsan.com/consulta/?placa=${PLACA_COMPLETA}`,
  falla: 'limite',
  revision: (window) => [
    ['aviso visible', () => visible(window, '#cq-aviso')],
    ['título de límite', () => texto(window, '#cq-aviso [data-campo="titulo"]') === 'Demasiadas consultas seguidas'],
    ['mensaje con los segundos del Retry-After', () => texto(window, '#cq-aviso [data-campo="texto"]').includes('17 segundos')],
    ['ofrece reintentar', () => window.document.getElementById('cq-reintentar').hidden === false],
  ],
});

/* ── G. Fallo de red ──────────────────────────────────────────────────────── */
await correr('G · fallo de red', {
  expediente: { ok: false, error: 'irrelevante' },
  url: `https://hidromaticosjsan.com/consulta/?placa=${PLACA_COMPLETA}`,
  falla: 'red',
  revision: (window) => [
    ['aviso visible', () => visible(window, '#cq-aviso')],
    ['título de error del taller', () => texto(window, '#cq-aviso [data-campo="titulo"]') === 'No pudimos consultar el taller'],
    [
      'ofrece reintentar y WhatsApp',
      () =>
        window.document.getElementById('cq-reintentar').hidden === false &&
        window.document.getElementById('cq-aviso-wa').hidden === false,
    ],
    ['resultado oculto', () => window.document.querySelector('#cq-resultado').hidden === true],
  ],
});

console.log('\n──────────────────────────────────────────────');
console.log(`Pruebas: ${total} · Fallos: ${fallos.length}`);
if (fallos.length > 0) {
  for (const f of fallos) console.log(`  ❌ ${f}`);
  process.exit(1);
}
console.log('TODO VERDE ✅');

