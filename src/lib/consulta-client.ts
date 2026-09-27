/**
 * Cliente del Portal de Consulta (`/consulta/`) — Sprint 2.
 *
 * Orquesta: buscador de placa → GET /api/expediente → render del resultado
 * (tarjeta del vehículo, tracker, tabs con carrusel/visor de fotos, informe
 * X431 en diferido, historial y garantía) + estados de carga/vacío/error.
 *
 * Reglas del proyecto:
 *  · 100% lectura: los endpoints no escriben en Lark y aquí tampoco.
 *  · El contenido dinámico se inserta con createElement/textContent
 *    (nunca innerHTML con datos que vengan de la Base).
 *  · Compatible con ClientRouter: `initConsulta()` es idempotente por DOM
 *    (marca `data-cq-listo` en la página) y se re-ejecuta en `astro:page-load`.
 */
import { SITE } from '../data/site';
import { resetLazyEmbed, setupLazyEmbeds } from './lazyEmbed';

/* ───────────────────────────── DTO (espejo del API) ─────────────────────────── */

export interface FotoDTO {
  nombre: string;
  mime: string;
  tamano: number;
  url: string;
}

export interface RecepcionDTO {
  nroEntrada: string;
  fecha: string;
  km?: number;
  sintoma?: string;
  fotos: FotoDTO[];
  /** Fotos que existen pero no son firmables con el bot (se piden por WhatsApp). */
  fotosSinAcceso?: number;
  videos: { cantidad: number };
}

type InformeRef = { informeId: string; reportType: string; url: string } | { pendiente: true };

export interface OrdenDTO {
  nroOT: string;
  estado: string;
  /** 0..6 pipeline · -1 cancelado · -2 imprevisto / en espera */
  etapa: number;
  diasEnTaller?: number;
  fechaIngreso: string;
  fechaEntrega?: string;
  kmEntrada?: number;
  sintoma?: string;
  recepcion?: RecepcionDTO;
  informeX431?: InformeRef;
}

export interface VehiculoDTO {
  marcaModelo: string;
  ano?: number;
  color?: string;
  vin?: string;
  kmUltimaVisita?: number;
  totalOTs: number;
}

export interface GarantiaDTO {
  activa: boolean;
  estado?: string;
  desde?: string;
  ref?: string;
  vigencia?: string;
  whatsappUrl: string;
}

export interface ExpedienteDTO {
  ok: true;
  encontrado: true;
  placa: string;
  actualizado: string;
  vehiculo: VehiculoDTO;
  ordenes: OrdenDTO[];
  garantia: GarantiaDTO;
}

interface NoEncontradoDTO {
  ok: true;
  encontrado: false;
  placa: string;
  actualizado: string;
}

interface FallaDTO {
  codigo: string;
  descripcion: string;
  estado: string;
}

interface InformeX431DTO {
  informeId: string;
  reportType: string;
  reportCode: string;
  fecha: string;
  tester: string;
  vehiculo: string;
  duracionSeg?: number;
  totalSistemas: number;
  totalFallas: number;
  sistemas: { nombre: string; fallas: FallaDTO[] }[];
  sistemasOk: string[];
}

/* ──────────────────────────────── Utilidades ────────────────────────────────── */

const TZ = 'America/Caracas';
const CLAVE_PLACA = 'jsan.consulta.placa';

const wa = (texto: string) => `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(texto)}`;

/** Misma normalización que la fórmula `Placa Norm` de Lark y el API. */
export function normalizarPlaca(entrada: string): string {
  return String(entrada ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function placaValida(placa: string): boolean {
  return /^[A-Z0-9]{5,8}$/.test(placa);
}

const fmtFecha = (iso?: string): string => {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
};

const fmtFechaHora = (iso?: string): string => {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(fecha);
};

const fmtNumero = (n?: number): string =>
  typeof n === 'number' && Number.isFinite(n)
    ? new Intl.NumberFormat('es-VE').format(n)
    : '';

const fmtKm = (n?: number): string => {
  const texto = fmtNumero(n);
  return texto ? `${texto} km` : '';
};

const fmtDuracion = (seg?: number): string => {
  if (!seg || seg <= 0) return '';
  const min = Math.floor(seg / 60);
  const resto = Math.round(seg % 60);
  if (min === 0) return `${resto} s`;
  return resto > 0 ? `${min} min ${resto} s` : `${min} min`;
};

/** "hace unos segundos / 5 min / 2 h / 3 días" a partir del ISO `actualizado`. */
const haceCuando = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'hace un momento';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'hace unos segundos';
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
};

const prefiereMenosMovimiento = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ──────────────────────────────── Estado en memoria ─────────────────────────── */

let placaActual = '';
let expedienteActual: ExpedienteDTO | null = null;
let fotosActuales: FotoDTO[] = [];
let visorIndice = 0;
let visorFocoPrevio: HTMLElement | null = null;
let informeCargado: { informeId: string; datos: InformeX431DTO | null } | null = null;
let peticionEnCurso: AbortController | null = null;
let observadorFotos: IntersectionObserver | null = null;

/* ──────────────────────────────── Helpers de DOM ────────────────────────────── */

const porId = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

const porSel = <T extends HTMLElement = HTMLElement>(
  sel: string,
  raiz: ParentNode | null = document,
): T | null => raiz?.querySelector<T>(sel) ?? null;

function mostrar(el: Element | null, visible: boolean): void {
  if (el instanceof HTMLElement) el.hidden = !visible;
}

function ponerTexto(raiz: ParentNode | null, campo: string, valor: string): void {
  const el = porSel<HTMLElement>(`[data-campo="${campo}"]`, raiz);
  if (el && el.textContent !== valor) el.textContent = valor;
}

function anunciar(texto: string): void {
  const el = porId('cq-anuncio');
  if (el) el.textContent = texto;
}

function crear<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  clases?: string,
  texto?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(etiqueta);
  if (clases) el.className = clases;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

type Vista = 'inicio' | 'cargando' | 'resultado' | 'noencontrada' | 'aviso';

function mostrarVista(vista: Vista): void {
  mostrar(porId('cq-inicio'), vista === 'inicio');
  mostrar(porId('cq-skeleton'), vista === 'cargando');
  mostrar(porId('cq-resultado'), vista === 'resultado');
  mostrar(porId('cq-noencontrada'), vista === 'noencontrada');
  mostrar(porId('cq-aviso'), vista === 'aviso');
  const zona = porId('cq-zona');
  if (zona) zona.setAttribute('aria-busy', vista === 'cargando' ? 'true' : 'false');
}

function mostrarAviso(
  titulo: string,
  texto: string,
  opciones: { reintentar?: boolean; whatsapp?: boolean } = {},
): void {
  ponerTexto(porId('cq-aviso'), 'titulo', titulo);
  ponerTexto(porId('cq-aviso'), 'texto', texto);
  mostrar(porId('cq-reintentar'), opciones.reintentar !== false);
  mostrar(porId('cq-aviso-wa'), opciones.whatsapp !== false);
  mostrarVista('aviso');
}

/* ────────────────────────────── Render: vehículo ────────────────────────────── */

function pintarVehiculo(exp: ExpedienteDTO): void {
  const v = exp.vehiculo;
  const tarjeta = porId('cq-vehiculo');
  ponerTexto(tarjeta, 'placa', exp.placa);
  ponerTexto(tarjeta, 'titulo', [exp.placa, v.marcaModelo].filter(Boolean).join(' · ') || 'Expediente del vehículo');
  ponerTexto(tarjeta, 'ano', v.ano ? String(v.ano) : '');
  ponerTexto(tarjeta, 'color', v.color ?? '');
  ponerTexto(tarjeta, 'km', fmtKm(v.kmUltimaVisita));
  ponerTexto(tarjeta, 'visitas', v.totalOTs > 0 ? String(v.totalOTs) : '');

  const datos: [string, boolean][] = [
    ['ano', Boolean(v.ano)],
    ['color', Boolean(v.color)],
    ['km', Boolean(fmtKm(v.kmUltimaVisita))],
    ['visitas', v.totalOTs > 0],
  ];
  for (const [dato, hay] of datos) mostrar(porSel(`[data-dato="${dato}"]`, tarjeta), hay);
  mostrar(tarjeta, true);
}

/* ────────────────────────────── Render: tracker ─────────────────────────────── */

const ULTIMO_PASO = 6;

/** Copia visual por etapa: icono + explicación humana del estado. */
const ESTADO_META: Record<number, { icono: string; titulo: string; detalle: string }> = {
  0: {
    icono: '📥',
    titulo: 'Recibimos tu carro',
    detalle: 'Ya está registrado en el taller; en breve pasa al diagnóstico.',
  },
  1: {
    icono: '🔍',
    titulo: 'Lo estamos diagnosticando',
    detalle: 'El especialista está leyendo el scanner y revisando el sistema.',
  },
  2: {
    icono: '💰',
    titulo: 'Presupuesto por aprobar',
    detalle: 'Te enviamos el presupuesto; esperamos tu aprobación por WhatsApp.',
  },
  3: {
    icono: '✅',
    titulo: 'Trabajo aprobado',
    detalle: 'Aprobaste el trabajo: tu carro entra a reparación.',
  },
  4: {
    icono: '🔧',
    titulo: 'Estamos trabajando',
    detalle: 'El equipo está reparando tu transmisión ahora mismo.',
  },
  5: {
    icono: '🏁',
    titulo: 'Tu carro está listo',
    detalle: 'La reparación terminó; coordinamos la entrega.',
  },
  6: {
    icono: '📦',
    titulo: 'Entregado',
    detalle: 'El trabajo quedó cerrado y entregado. ¡Gracias por confiar en J-SAN!',
  },
  '-1': {
    icono: '❌',
    titulo: 'Orden cancelada',
    detalle: 'Si tienes dudas del motivo, escríbenos por WhatsApp.',
  },
  '-2': {
    icono: '⚠️',
    titulo: 'Imprevisto / en espera',
    detalle: 'Hay una novedad en proceso; el equipo te contactará por WhatsApp.',
  },
};

function pintarTracker(ordenes: OrdenDTO[]): void {
  const tracker = porId('cq-tracker');
  const actual = ordenes[0];
  if (!tracker || !actual) {
    mostrar(tracker, false);
    return;
  }

  ponerTexto(tracker, 'nroOT', actual.nroOT || '—');

  // Estado actual en grande (la respuesta rápida a «¿dónde está mi carro?»)
  const meta = ESTADO_META[actual.etapa] ?? ESTADO_META[0];
  ponerTexto(tracker, 'estado-icono', meta.icono);
  ponerTexto(tracker, 'estado-titulo', meta.titulo);
  ponerTexto(tracker, 'estado-detalle', meta.detalle);
  const hero = porSel<HTMLElement>('[data-campo="estado-hero"]', tracker);
  if (hero) hero.classList.toggle('is-detenido', actual.etapa < 0);

  // Barra de progreso: se oculta si la orden está cancelada o en imprevisto.
  const progreso = porSel<HTMLElement>('[data-campo="progreso"]', tracker);
  if (progreso) {
    const avanzando = actual.etapa >= 0;
    mostrar(progreso, avanzando);
    if (avanzando) {
      const pct = Math.round(((actual.etapa + 1) / (ULTIMO_PASO + 1)) * 100);
      const relleno = porSel<HTMLElement>('[data-campo="progreso-relleno"]', tracker);
      if (relleno) relleno.style.width = `${pct}%`;
      const carril = porSel<HTMLElement>('[data-campo="progreso-carril"]', tracker);
      if (carril) carril.setAttribute('aria-valuenow', String(actual.etapa + 1));
      ponerTexto(
        tracker,
        'progreso-texto',
        actual.etapa === ULTIMO_PASO ? 'Completado · 7 de 7' : `Paso ${actual.etapa + 1} de 7`,
      );
    }
  }

  const dias = porSel<HTMLSpanElement>('[data-campo="dias"]', tracker);
  const hayDias =
    typeof actual.diasEnTaller === 'number' &&
    actual.diasEnTaller > 0 &&
    actual.etapa >= 0 &&
    actual.etapa < ULTIMO_PASO;
  if (dias) {
    dias.textContent = hayDias
      ? `⏱ ${actual.diasEnTaller} ${actual.diasEnTaller === 1 ? 'día' : 'días'} en taller`
      : '';
    dias.hidden = !hayDias;
  }

  const banner = porId('cq-banner');
  if (banner) {
    banner.classList.toggle('is-cancelado', actual.etapa === -1);
    banner.hidden = actual.etapa >= 0;
    banner.textContent =
      actual.etapa === -1
        ? '❌ Esta orden fue cancelada. Si tienes dudas del motivo, escríbenos por WhatsApp.'
        : actual.etapa === -2
          ? '⚠️ Hay un imprevisto o la orden está en espera. El equipo está gestionando una novedad y te contactará por WhatsApp.'
          : '';
  }

  const pasos = porId('cq-pasos');
  if (pasos) {
    pasos.classList.toggle('is-detenido', actual.etapa < 0);
    pasos.querySelectorAll<HTMLElement>('li[data-paso]').forEach((li) => {
      const indice = Number(li.dataset.paso ?? -1);
      li.classList.toggle('is-done', actual.etapa >= 0 && indice < actual.etapa);
      li.classList.toggle('is-current', actual.etapa >= 0 && indice === actual.etapa);
    });
  }

  const pie: string[] = [];
  if (fmtFecha(actual.fechaIngreso)) pie.push(`Ingresó el ${fmtFecha(actual.fechaIngreso)}`);
  if (actual.etapa === ULTIMO_PASO && actual.fechaEntrega) {
    pie.push(`Entregado el ${fmtFecha(actual.fechaEntrega)}`);
  }
  ponerTexto(tracker, 'pie', pie.join(' · '));

  mostrar(tracker, true);
}

/* ───────────────────────────── Render: recepción ────────────────────────────── */

function pintarRecepcion(ordenes: OrdenDTO[], placa: string): void {
  const actual = ordenes[0];
  const rec = actual?.recepcion;
  const ficha = porId('cq-recep-ficha');

  if (!rec) {
    mostrar(ficha, false);
    mostrar(porId('cq-recep-vacio'), true);
    pintarFotos([], placa);
    pintarAvisos(undefined, placa);
    return;
  }

  mostrar(porId('cq-recep-vacio'), false);
  ponerTexto(ficha, 'nroEntrada', rec.nroEntrada ? `N.º ${rec.nroEntrada}` : '—');
  ponerTexto(ficha, 'fecha', fmtFecha(rec.fecha) || '—');
  ponerTexto(ficha, 'km', fmtKm(rec.km ?? actual?.kmEntrada) || '—');

  const sintoma = (rec.sintoma ?? actual?.sintoma ?? '').trim();
  const elSintoma = porSel<HTMLParagraphElement>('[data-campo="sintoma"]', ficha);
  if (elSintoma) {
    elSintoma.textContent = sintoma ? `“${sintoma}”` : '';
    elSintoma.hidden = !sintoma;
  }
  mostrar(ficha, true);

  pintarFotos(rec.fotos, placa);
  pintarAvisos(rec, placa);
}

/* ──────────────────────── Render: avisos de video / fotos ───────────────────── */

function pintarAvisos(rec: RecepcionDTO | undefined, placa: string): void {
  const entrada = rec?.nroEntrada ? ` (entrada N.º ${rec.nroEntrada})` : '';

  const avisoVideo = porId('cq-aviso-video');
  const cantidad = rec?.videos?.cantidad ?? 0;
  if (avisoVideo) {
    if (cantidad > 0) {
      ponerTexto(
        avisoVideo,
        'titulo',
        cantidad === 1 ? 'Poseemos 1 video de tu ingreso' : `Poseemos ${cantidad} videos de tu ingreso`,
      );
      ponerTexto(
        avisoVideo,
        'texto',
        'Por privacidad el video no se reproduce aquí: pídelo por WhatsApp y te lo enviamos.',
      );
      const enlace = porSel<HTMLAnchorElement>('[data-campo="wa"]', avisoVideo);
      if (enlace) {
        enlace.href = wa(
          `Hola J-SAN, quiero ver el video del ingreso de mi vehículo placa ${placa}${entrada}.`,
        );
      }
      avisoVideo.hidden = false;
    } else {
      avisoVideo.hidden = true;
    }
  }

  const avisoFotos = porId('cq-aviso-fotos');
  const sinAcceso = rec?.fotosSinAcceso ?? 0;
  if (avisoFotos) {
    if (sinAcceso > 0) {
      ponerTexto(
        avisoFotos,
        'titulo',
        sinAcceso === 1
          ? 'Tenemos 1 foto adicional de tu vehículo'
          : `Tenemos ${sinAcceso} fotos adicionales de tu vehículo`,
      );
      ponerTexto(
        avisoFotos,
        'texto',
        'Están guardadas en el taller: pídelas por WhatsApp y te las enviamos.',
      );
      const enlace = porSel<HTMLAnchorElement>('[data-campo="wa"]', avisoFotos);
      if (enlace) {
        enlace.href = wa(
          `Hola J-SAN, quiero recibir las fotos adicionales del ingreso de mi vehículo placa ${placa}${entrada}.`,
        );
      }
      avisoFotos.hidden = false;
    } else {
      avisoFotos.hidden = true;
    }
  }
}

/* ───────────────────────────── Render: historial ────────────────────────────── */

function claseEstadoHistorial(etapa: number): string {
  if (etapa === -1) return ' is-cancelado';
  if (etapa === -2) return ' is-imprevisto';
  if (etapa === ULTIMO_PASO) return ' is-entregado';
  return '';
}

function tarjetaHistorial(orden: OrdenDTO, esActual: boolean): HTMLElement {
  const card = crear('article', `cq-hist-card${esActual ? ' is-actual' : ''}`);

  const cabecera = crear('div', 'cq-hist-cabecera');
  const bloqueOt = crear('div');
  bloqueOt.appendChild(
    crear('span', 'cq-hist-ot', orden.nroOT ? `OT ${orden.nroOT}` : 'Orden de trabajo'),
  );
  if (esActual) bloqueOt.appendChild(crear('span', 'cq-hist-badge', 'Visita actual'));
  cabecera.append(
    bloqueOt,
    crear('span', `cq-hist-estado${claseEstadoHistorial(orden.etapa)}`, orden.estado || 'En taller'),
  );
  card.appendChild(cabecera);

  const meta = crear('div', 'cq-hist-meta');
  if (fmtFecha(orden.fechaIngreso)) {
    meta.appendChild(crear('span', undefined, `Ingreso: ${fmtFecha(orden.fechaIngreso)}`));
  }
  if (fmtKm(orden.kmEntrada)) {
    meta.appendChild(crear('span', undefined, `Km: ${fmtKm(orden.kmEntrada)}`));
  }
  if (orden.etapa === ULTIMO_PASO && orden.fechaEntrega) {
    meta.appendChild(crear('span', undefined, `Entrega: ${fmtFecha(orden.fechaEntrega)}`));
  } else if (
    typeof orden.diasEnTaller === 'number' &&
    orden.diasEnTaller > 0 &&
    orden.etapa >= 0 &&
    orden.etapa < ULTIMO_PASO
  ) {
    meta.appendChild(
      crear('span', undefined, `⏱ ${orden.diasEnTaller} ${orden.diasEnTaller === 1 ? 'día' : 'días'}`),
    );
  }
  if (meta.childElementCount > 0) card.appendChild(meta);

  const sintoma = (orden.sintoma ?? orden.recepcion?.sintoma ?? '').trim();
  if (sintoma) card.appendChild(crear('p', 'cq-hist-sintoma', `“${sintoma}”`));

  return card;
}

function pintarHistorial(ordenes: OrdenDTO[]): void {
  const lista = porId('cq-hist-lista');
  if (!lista) return;
  lista.textContent = '';
  mostrar(porId('cq-hist-vacio'), ordenes.length === 0);
  ordenes.forEach((orden, i) => lista.appendChild(tarjetaHistorial(orden, i === 0)));
}

/* ────────────────────────────── Render: garantía ────────────────────────────── */

function pintarGarantia(g: GarantiaDTO): void {
  const caja = porId('cq-garantia');
  if (!caja) return;

  ponerTexto(caja, 'desde', fmtFecha(g.desde) || '—');

  const ref = porSel<HTMLSpanElement>('[data-campo="ref"]', caja);
  if (ref) {
    ref.textContent = g.ref ?? '';
    ref.hidden = !g.ref;
  }

  const vigencia = porSel<HTMLParagraphElement>('[data-campo="vigencia"]', caja);
  if (vigencia) {
    vigencia.textContent = g.vigencia ? `Vigencia: ${g.vigencia}` : '';
    vigencia.hidden = !g.vigencia;
  }

  mostrar(porId('cq-garantia-activa'), g.activa);
  mostrar(porId('cq-garantia-inactiva'), !g.activa);

  const enlace = porId<HTMLAnchorElement>('cq-garantia-wa');
  if (enlace && g.whatsappUrl) enlace.href = g.whatsappUrl;

  mostrar(caja, true);
}

/* ─────────────────────────────── Carrusel de fotos ──────────────────────────── */

function pintarFotos(fotos: FotoDTO[], placa: string): void {
  fotosActuales = fotos;
  const contenedor = porId('cq-fotos');
  const viewport = porId('cq-fotos-viewport');
  const track = porId('cq-fotos-track');
  const dots = porId('cq-fotos-dots');
  if (!contenedor || !viewport || !track || !dots) return;

  observadorFotos?.disconnect();
  track.textContent = '';
  dots.textContent = '';

  if (fotos.length === 0) {
    mostrar(contenedor, false);
    return;
  }
  mostrar(contenedor, true);

  // Carga diferida real: solo la foto visible ±1 (rootMargin del ancho del viewport)
  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const img = porSel<HTMLImageElement>('img[data-src]', entrada.target);
        if (img) {
          img.src = img.dataset.src ?? '';
          delete img.dataset.src;

          // Precarga de la 2.ª foto: el primer swipe arranca instantáneo.
          const slide = entrada.target as HTMLElement;
          if (slide === track.firstElementChild) {
            const segundo = track.querySelectorAll<HTMLElement>('.cq-slide')[1];
            const img2 = segundo ? porSel<HTMLImageElement>('img[data-src]', segundo) : null;
            if (img2 && segundo) {
              img2.src = img2.dataset.src ?? '';
              delete img2.dataset.src;
              img2.addEventListener('load', () => segundo.classList.add('is-lista'), { once: true });
            }
          }
        }
        observador.unobserve(entrada.target);
      }
    },
    { root: viewport, rootMargin: '0px 100% 0px 100%' },
  );
  observadorFotos = observador;

  fotos.forEach((foto, i) => {
    const slide = crear('figure', 'cq-slide');
    const boton = crear('button', 'cq-slide-btn');
    boton.type = 'button';
    boton.setAttribute('aria-label', `Ver foto ${i + 1} de ${fotos.length} en pantalla completa`);
    boton.addEventListener('click', () => abrirVisor(i, boton));

    const img = crear('img');
    img.alt = `Foto de recepción — placa ${placa} — ${i + 1} de ${fotos.length}`;
    if (i === 0) {
      img.loading = 'eager';
      img.fetchPriority = 'high';
    } else {
      img.loading = 'lazy';
    }
    img.decoding = 'async';
    img.dataset.src = foto.url;
    img.addEventListener('load', () => slide.classList.add('is-lista'), { once: true });

    boton.appendChild(img);
    slide.appendChild(boton);
    track.appendChild(slide);
    observador.observe(slide);

    const dot = crear('button', 'cq-dot');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Ir a la foto ${i + 1}`);
    dot.appendChild(crear('i'));
    dot.addEventListener('click', () => irAFoto(i));
    dots.appendChild(dot);
  });

  actualizarCarrusel();
  requestAnimationFrame(() => irAFoto(0, 'auto'));
}

function actualizarCarrusel(): void {
  const viewport = porId('cq-fotos-viewport');
  const track = porId('cq-fotos-track');
  const dots = porId('cq-fotos-dots');
  if (!viewport || !track || !dots) return;

  const indice = Math.min(Math.max(fotosActuales.length - 1, 0), indiceActualCarrusel());

  const contador = porSel<HTMLElement>('[data-campo="contador"]', porId('cq-fotos'));
  if (contador) contador.textContent = `${fotosActuales.length ? indice + 1 : 0}/${fotosActuales.length}`;

  dots.querySelectorAll<HTMLElement>('.cq-dot').forEach((dot, i) => {
    dot.classList.toggle('is-activo', i === indice);
    dot.setAttribute('aria-current', i === indice ? 'true' : 'false');
  });

  const prev = porSel<HTMLButtonElement>('[data-accion="prev"]', porId('cq-fotos'));
  const next = porSel<HTMLButtonElement>('[data-accion="next"]', porId('cq-fotos'));
  if (prev) prev.disabled = indice === 0;
  if (next) next.disabled = indice >= fotosActuales.length - 1;
}

function irAFoto(indice: number, forzar?: ScrollBehavior): void {
  const viewport = porId('cq-fotos-viewport');
  const track = porId('cq-fotos-track');
  const slide = track?.querySelectorAll<HTMLElement>('.cq-slide')[indice];
  if (!viewport || !track || !slide) return;
  const izquierda =
    slide.offsetLeft - track.offsetLeft - (viewport.clientWidth - slide.offsetWidth) / 2;
  viewport.scrollTo({
    left: Math.max(0, izquierda),
    behavior: forzar ?? (prefiereMenosMovimiento() ? 'auto' : 'smooth'),
  });
}

/* ──────────────────────────────── Visor de fotos ───────────────────────────── */

const visorAbierto = (): boolean => {
  const visor = porId('cq-visor');
  return Boolean(visor && !visor.hidden);
};

function abrirVisor(indice: number, origen?: HTMLElement): void {
  const visor = porId('cq-visor');
  if (!visor || fotosActuales.length === 0) return;

  visorIndice = indice;
  visorFocoPrevio = origen ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  pintarVisor();
  visor.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  porSel<HTMLButtonElement>('[data-accion="cerrar"]', visor)?.focus();
}

function pintarVisor(): void {
  const visor = porId('cq-visor');
  const foto = fotosActuales[visorIndice];
  if (!visor || !foto) return;

  const img = porId<HTMLImageElement>('cq-visor-img');
  if (img) {
    img.classList.remove('is-zoom');
    if (img.getAttribute('src') !== foto.url) {
      img.classList.remove('is-lista');
      img.addEventListener('load', () => img.classList.add('is-lista'), { once: true });
      img.addEventListener('error', () => img.classList.add('is-lista'), { once: true });
      img.fetchPriority = 'high';
      img.decoding = 'async';
      img.src = foto.url;
    }
    img.alt = `Foto de recepción — ${visorIndice + 1} de ${fotosActuales.length}`;
  }

  // Precarga de vecinas: al deslizar, la siguiente foto ya está en memoria.
  for (const i of [visorIndice - 1, visorIndice + 1]) {
    const vecina = fotosActuales[i];
    if (!vecina) continue;
    const pre = document.createElement("img");
    pre.decoding = 'async';
    pre.src = vecina.url;
  }

  const contador = porSel<HTMLElement>('[data-campo="contador"]', visor);
  if (contador) contador.textContent = `${visorIndice + 1}/${fotosActuales.length}`;

  const descargar = porId<HTMLAnchorElement>('cq-visor-descargar');
  if (descargar) {
    descargar.href = foto.url;
    descargar.setAttribute('download', foto.nombre || 'foto.jpg');
  }

  const prev = porSel<HTMLButtonElement>('.cq-visor-prev', visor);
  const next = porSel<HTMLButtonElement>('.cq-visor-next', visor);
  if (prev) prev.disabled = visorIndice === 0;
  if (next) next.disabled = visorIndice === fotosActuales.length - 1;
}

function moverVisor(paso: number): void {
  if (fotosActuales.length === 0) return;
  visorIndice = (visorIndice + paso + fotosActuales.length) % fotosActuales.length;
  pintarVisor();
}

function cerrarVisor(): void {
  const visor = porId('cq-visor');
  if (!visor || visor.hidden) return;
  visor.hidden = true;
  document.documentElement.style.overflow = '';
  const img = porId<HTMLImageElement>('cq-visor-img');
  if (img) img.src = '';
  visorFocoPrevio?.focus();
  visorFocoPrevio = null;
}

function alternarZoom(): void {
  const img = porId<HTMLImageElement>('cq-visor-img');
  if (img) img.classList.toggle('is-zoom');
}

/** Mantiene el foco dentro del diálogo mientras el visor está abierto. */
function atraparFoco(evento: KeyboardEvent): void {
  const visor = porId('cq-visor');
  if (!visor) return;
  const focos = Array.from(visor.querySelectorAll<HTMLElement>('button:not([hidden]), a[href]')).filter(
    (el) => !el.hasAttribute('disabled'),
  );
  if (focos.length === 0) return;
  const primero = focos[0];
  const ultimo = focos[focos.length - 1];
  const activo = document.activeElement;
  if (evento.shiftKey && (activo === primero || !visor.contains(activo))) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && activo === ultimo) {
    evento.preventDefault();
    primero.focus();
  }
}

function manejarTecladoGlobal(evento: KeyboardEvent): void {
  if (!visorAbierto()) return;
  if (evento.key === 'Escape') {
    evento.preventDefault();
    cerrarVisor();
  } else if (evento.key === 'ArrowLeft') {
    moverVisor(-1);
  } else if (evento.key === 'ArrowRight') {
    moverVisor(1);
  } else if (evento.key === 'Tab') {
    atraparFoco(evento);
  }
}

/** Swipe horizontal (cambiar) y vertical hacia abajo (cerrar) + doble toque (zoom). */
function vincularGestosDelVisor(escena: HTMLElement): void {
  let x0 = 0;
  let y0 = 0;
  let ultimoToque = 0;

  escena.addEventListener(
    'touchstart',
    (evento) => {
      const toque = evento.changedTouches[0];
      x0 = toque.clientX;
      y0 = toque.clientY;
      const ahora = Date.now();
      if (ahora - ultimoToque < 320) {
        alternarZoom();
        ultimoToque = 0;
      } else {
        ultimoToque = ahora;
      }
    },
    { passive: true },
  );

  escena.addEventListener(
    'touchend',
    (evento) => {
      const toque = evento.changedTouches[0];
      const dx = toque.clientX - x0;
      const dy = toque.clientY - y0;
      const img = porId<HTMLImageElement>('cq-visor-img');
      if (img?.classList.contains('is-zoom')) return;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        moverVisor(dx < 0 ? 1 : -1);
      } else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
        cerrarVisor();
      }
    },
    { passive: true },
  );

  escena.addEventListener('dblclick', (evento) => {
    evento.preventDefault();
    alternarZoom();
  });
}

/* ────────────────────────────── Informe X431 ────────────────────────────────── */

type EstadoX431 = 'vacio' | 'carga' | 'error' | 'ok';

function estadoX431(estado: EstadoX431): void {
  mostrar(porId('cq-x431-vacio'), estado === 'vacio');
  mostrar(porId('cq-x431-carga'), estado === 'carga');
  mostrar(porId('cq-x431-error'), estado === 'error');
  mostrar(porId('cq-x431-ok'), estado === 'ok');
}

const referenciaInforme = (
  orden: OrdenDTO | undefined,
): { informeId: string; reportType: string; url: string } | null => {
  const ref = orden?.informeX431;
  return ref && 'informeId' in ref ? ref : null;
};

function fijarEnlaceOriginal(id: string, url: string): void {
  const enlace = porId<HTMLAnchorElement>(id);
  if (enlace) enlace.href = url;
}

/** Texto de la fachada del iframe del informe (cambia según el estado). */
function textoEmbed(texto: string): void {
  ponerTexto(porId('cq-x431-embed'), 'embed-texto', texto);
}

/**
 * Monta el iframe diferido del informe original reutilizando el patrón
 * `data-lazy-embed` de `src/lib/lazyEmbed.ts` (fachada sin red, carga al toque,
 * timeout con reintento y salida a pestaña nueva). Se reinicia cuando cambia
 * la URL del informe.
 */
function montarEmbedInforme(url: string): void {
  const bloque = porId('cq-x431-embed');
  const marco = porId('cq-x431-embed-marco');
  if (!bloque || !marco) return;

  fijarEnlaceOriginal('cq-x431-embed-original', url);
  fijarEnlaceOriginal('cq-x431-embed-original-2', url);
  mostrar(bloque, true);

  if (marco.dataset.src === url) return; // ya inicializado para este informe

  resetLazyEmbed(marco); // desarma el informe anterior (escuchas, timeout e iframe)
  marco.dataset.src = url;
  setupLazyEmbeds();
}

/** Oculta y descarga el iframe del informe (cambio de placa o de expediente). */
function reiniciarEmbedInforme(): void {
  const bloque = porId('cq-x431-embed');
  const marco = porId('cq-x431-embed-marco');
  mostrar(bloque, false);
  if (!marco) return;
  resetLazyEmbed(marco);
  delete marco.dataset.src;
}

async function cargarInforme(orden: OrdenDTO | undefined, forzar = false): Promise<void> {
  const ref = referenciaInforme(orden);
  if (!ref) {
    informeCargado = null;
    estadoX431('vacio');
    return;
  }

  fijarEnlaceOriginal('cq-x431-original', ref.url);
  fijarEnlaceOriginal('cq-x431-original-error', ref.url);
  montarEmbedInforme(ref.url);
  textoEmbed(
    'El informe original completo también se puede ver aquí mismo: se descarga solo cuando lo pides.',
  );

  if (!forzar && informeCargado?.informeId === ref.informeId) {
    estadoX431(informeCargado.datos ? 'ok' : 'error');
    return;
  }

  estadoX431('carga');
  try {
    const respuesta = await fetch(
      `/api/x431?doc=${encodeURIComponent(ref.informeId)}&rt=${encodeURIComponent(ref.reportType || 'X2')}`,
      { headers: { Accept: 'application/json' } },
    );
    const datos = (await respuesta.json().catch(() => null)) as
      | { ok: true; informe: InformeX431DTO }
      | { ok: false; error?: string }
      | null;

    if (!respuesta.ok || !datos || !datos.ok) throw new Error('sin_informe');
    informeCargado = { informeId: ref.informeId, datos: datos.informe };
    pintarInforme(datos.informe);
    estadoX431('ok');
  } catch {
    informeCargado = { informeId: ref.informeId, datos: null };
    estadoX431('error');
    textoEmbed(
      'El render nativo no está disponible en este momento. Puedes abrir el informe original aquí mismo.',
    );
  }
}

function pintarInforme(d: InformeX431DTO): void {
  const caja = porId('cq-x431');
  ponerTexto(caja, 'fecha', fmtFechaHora(d.fecha) || '—');
  ponerTexto(caja, 'tester', d.tester || 'Scanner X431');
  ponerTexto(caja, 'duracion', fmtDuracion(d.duracionSeg) || '—');
  ponerTexto(caja, 'sistemas', String(d.totalSistemas || d.sistemas.length + d.sistemasOk.length));
  ponerTexto(caja, 'fallas', String(d.totalFallas));

  const sistemas = porId('cq-x431-sistemas');
  if (sistemas) {
    sistemas.textContent = '';

    const codigos = d.sistemas.flatMap((s) => s.fallas.map((f) => f.codigo)).filter(Boolean);
    if (codigos.length > 0) {
      // Rótulo dentro del mismo grupo: sin él, los códigos sueltos parecen un
      // resto de maquetación (detectado en QA visual, 26-sep).
      const grupo = crear('div', 'cq-x431-codigos');
      grupo.appendChild(crear('h5', 'cq-x431-codigos-titulo', 'Códigos detectados'));
      const fila = crear('div', 'cq-x431-pills');
      codigos.forEach((codigo) => fila.appendChild(crear('span', 'cq-pill is-falla', codigo)));
      grupo.appendChild(fila);
      sistemas.appendChild(grupo);
    }

    d.sistemas.forEach((sistema) => {
      const bloque = crear('div', 'cq-sistema');
      bloque.appendChild(crear('span', 'cq-sistema-nombre', sistema.nombre || 'Sistema'));
      sistema.fallas.forEach((falla) => {
        const fila = crear('div', 'cq-falla');
        fila.appendChild(crear('span', 'cq-falla-codigo', falla.codigo));
        fila.appendChild(crear('span', 'cq-falla-desc', falla.descripcion || 'Sin descripción'));
        if (falla.estado) fila.appendChild(crear('span', 'cq-falla-estado', falla.estado));
        bloque.appendChild(fila);
      });
      sistemas.appendChild(bloque);
    });
  }

  const listaOk = porId('cq-x431-ok-lista');
  if (listaOk) {
    listaOk.textContent = '';
    d.sistemasOk.forEach((nombre) => listaOk.appendChild(crear('span', 'cq-pill is-ok', nombre)));
  }
  mostrar(porId('cq-x431-ok-wrap'), d.sistemasOk.length > 0);
}

/* ───────────────────────────── Tabs del resultado ───────────────────────────── */

const TABS: { boton: string; panel: string }[] = [
  { boton: 'cq-tab-recepcion', panel: 'cq-panel-recepcion' },
  { boton: 'cq-tab-x431', panel: 'cq-panel-x431' },
  { boton: 'cq-tab-historial', panel: 'cq-panel-historial' },
  { boton: 'cq-tab-garantia', panel: 'cq-panel-garantia' },
];

function activarTab(botonId: string, conFoco = false): void {
  for (const { boton, panel } of TABS) {
    const btn = porId<HTMLButtonElement>(boton);
    const pnl = porId(panel);
    const activo = boton === botonId;
    if (btn) {
      btn.classList.toggle('is-activo', activo);
      btn.setAttribute('aria-selected', activo ? 'true' : 'false');
      btn.tabIndex = activo ? 0 : -1;
      if (activo && conFoco) btn.focus();
    }
    mostrar(pnl, activo);
  }
  if (botonId === 'cq-tab-x431') void cargarInforme(expedienteActual?.ordenes[0]);
}

function tecladoTabs(evento: KeyboardEvent): void {
  const id = (evento.target as HTMLElement | null)?.id ?? '';
  const indice = TABS.findIndex(({ boton }) => boton === id);
  if (indice < 0) return;

  let destino = -1;
  if (evento.key === 'ArrowRight') destino = (indice + 1) % TABS.length;
  else if (evento.key === 'ArrowLeft') destino = (indice - 1 + TABS.length) % TABS.length;
  else if (evento.key === 'Home') destino = 0;
  else if (evento.key === 'End') destino = TABS.length - 1;
  if (destino < 0) return;

  evento.preventDefault();
  activarTab(TABS[destino].boton, true);
}

/* ─────────────────────────────── Consulta ───────────────────────────────────── */

const indiceActualCarrusel = (): number => {
  const viewport = porId('cq-fotos-viewport');
  const track = porId('cq-fotos-track');
  if (!viewport || !track) return 0;
  const centro = viewport.scrollLeft + viewport.clientWidth / 2;
  let mejor = 0;
  let mejorDist = Number.POSITIVE_INFINITY;
  track.querySelectorAll<HTMLElement>('.cq-slide').forEach((slide, i) => {
    const centroSlide = slide.offsetLeft - track.offsetLeft + slide.offsetWidth / 2;
    const distancia = Math.abs(centroSlide - centro);
    if (distancia < mejorDist) {
      mejorDist = distancia;
      mejor = i;
    }
  });
  return Math.min(Math.max(fotosActuales.length - 1, 0), mejor);
};

function guardarPlacaLocal(placa: string): void {
  try {
    localStorage.setItem(CLAVE_PLACA, placa);
  } catch {
    /* modo privado: sin memoria local */
  }
}

function leerPlacaLocal(): string {
  try {
    return localStorage.getItem(CLAVE_PLACA) ?? '';
  } catch {
    return '';
  }
}

function pintarExpediente(exp: ExpedienteDTO): void {
  expedienteActual = exp;
  placaActual = exp.placa;
  informeCargado = null;

  pintarVehiculo(exp);
  pintarTracker(exp.ordenes);
  pintarRecepcion(exp.ordenes, exp.placa);
  pintarHistorial(exp.ordenes);
  pintarGarantia(exp.garantia);
  reiniciarEmbedInforme();
  estadoX431('vacio');
  activarTab('cq-tab-recepcion');
  ponerTexto(document, 'actualizado', `Actualizado ${haceCuando(exp.actualizado)}`);
}

let t4Actual = '';

/** Últimos 4 dígitos del teléfono registrado: segundo factor de la consulta. */
function t4Valido(t4: string): boolean {
  return /^\d{4}$/.test(t4);
}

async function buscar(
  placaBruta: string,
  t4Bruto: string,
  opciones: { fresco?: boolean } = {},
): Promise<void> {
  const placa = normalizarPlaca(placaBruta);
  const t4 = String(t4Bruto ?? '').replace(/\D/g, '').slice(0, 4);
  const entrada = porId<HTMLInputElement>('cq-placa');
  const campo4 = porId<HTMLInputElement>('cq-t4');

  if (!placaValida(placa)) {
    if (entrada) {
      entrada.setAttribute('aria-invalid', 'true');
      entrada.focus();
    }
    mostrarAviso('Revisa la placa', 'Escríbela sin guiones ni espacios. Ejemplo: AE473LM.', {
      reintentar: false,
    });
    anunciar('Placa inválida. Escribe una placa válida, por ejemplo: AE473LM.');
    return;
  }
  entrada?.removeAttribute('aria-invalid');

  if (!t4Valido(t4)) {
    if (campo4) {
      campo4.setAttribute('aria-invalid', 'true');
      campo4.focus();
    }
    mostrarAviso(
      'Revisa el teléfono',
      'Escribe los últimos 4 dígitos del teléfono que registramos en la recepción.',
      { reintentar: false },
    );
    anunciar('Faltan los últimos 4 dígitos del teléfono.');
    return;
  }
  campo4?.removeAttribute('aria-invalid');

  peticionEnCurso?.abort();
  const control = new AbortController();
  peticionEnCurso = control;
  let expirado = false;
  const temporizador = window.setTimeout(() => {
    expirado = true;
    control.abort();
  }, 15_000);

  placaActual = placa;
  t4Actual = t4;
  if (entrada) entrada.value = placa;
  if (campo4) campo4.value = t4;
  mostrarVista('cargando');
  anunciar(`Consultando el expediente de la placa ${placa}…`);

  try {
    const respuesta = await fetch(
      `/api/expediente?placa=${encodeURIComponent(placa)}&t4=${encodeURIComponent(t4)}`,
      {
      signal: control.signal,
      // El botón «Actualizar» pide datos frescos aunque el navegador tenga caché.
      cache: opciones.fresco ? 'no-cache' : 'default',
      headers: { Accept: 'application/json' },
    });
    const datos = (await respuesta.json().catch(() => null)) as
      | ExpedienteDTO
      | NoEncontradoDTO
      | { ok: false; error?: string; mensaje?: string }
      | null;

    if (respuesta.status === 429) {
      const espera = Number(respuesta.headers.get('Retry-After') ?? 0) || 30;
      mostrarAviso('Demasiadas consultas seguidas', `Espera unos ${espera} segundos y vuelve a intentarlo.`);
      anunciar('Demasiadas consultas seguidas. Espera unos segundos.');
      return;
    }

    if (respuesta.status === 400) {
      mostrarAviso('Revisa la placa', 'Escríbela sin guiones ni espacios. Ejemplo: AE473LM.', {
        reintentar: false,
      });
      return;
    }

    if (respuesta.status === 403) {
      const detalle = datos as { error?: string; whatsappUrl?: string } | null;
      const enlaceWa = porId<HTMLAnchorElement>('cq-aviso-wa');
      if (enlaceWa && detalle?.whatsappUrl) enlaceWa.href = detalle.whatsappUrl;
      if (detalle?.error === 'telefono_no_registrado') {
        mostrarAviso(
          'Aún no tenemos tu teléfono',
          'Para cuidar tu expediente pedimos los últimos 4 dígitos del teléfono. Escríbenos por WhatsApp y lo registramos en minutos.',
          { reintentar: false, whatsapp: true },
        );
      } else {
        mostrarAviso(
          'Los datos no coinciden',
          'Los últimos 4 dígitos no coinciden con el teléfono que registramos en la recepción. Verifícalos o escríbenos por WhatsApp.',
          { reintentar: false, whatsapp: true },
        );
      }
      anunciar('No pudimos verificar el teléfono.');
      return;
    }

    if (!respuesta.ok || !datos || !datos.ok) {
      mostrarAviso(
        'No pudimos consultar el taller',
        'Intenta de nuevo en unos segundos. Si el problema continúa, escríbenos por WhatsApp.',
      );
      anunciar('No pudimos completar la consulta.');
      return;
    }

    if (!datos.encontrado) {
      ponerTexto(porId('cq-noencontrada'), 'placa', placa);
      mostrarVista('noencontrada');
      anunciar(`No encontramos la placa ${placa} en el sistema del taller.`);
      return;
    }

    guardarPlacaLocal(placa);
    pintarExpediente(datos);
    mostrarVista('resultado');
    anunciar(`Expediente de la placa ${placa} cargado.`);
    try {
      history.replaceState(null, '', `${location.pathname}?placa=${encodeURIComponent(placa)}`);
    } catch {
      /* algunos navegadores restringen replaceState */
    }
    porId('cq-resultado-titulo')?.focus({ preventScroll: true });
    porId('cq-zona')?.scrollIntoView({
      behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth',
      block: 'start',
    });
  } catch {
    // Si otra consulta la reemplazó, no se muestra nada (la nueva manda).
    if (control.signal.aborted && !expirado) return;

    if (expirado) {
      mostrarAviso(
        'La consulta tardó demasiado',
        'El taller está tardando en responder. Intenta de nuevo en unos segundos.',
      );
      anunciar('La consulta tardó demasiado.');
    } else {
      mostrarAviso(
        'No pudimos consultar el taller',
        'Revisa tu conexión e intenta de nuevo en unos segundos. Si el problema continúa, escríbenos por WhatsApp.',
      );
      anunciar('No pudimos completar la consulta.');
    }
  } finally {
    window.clearTimeout(temporizador);
    if (peticionEnCurso === control) peticionEnCurso = null;
  }
}

/* ─────────────────────────────── Enlaces de UI ─────────────────────────────── */

function vincular(): void {
  const form = porId<HTMLFormElement>('cq-buscador');
  const entrada = porId<HTMLInputElement>('cq-placa');
  const refrescar = porId<HTMLButtonElement>('cq-refrescar');
  const reintentar = porId<HTMLButtonElement>('cq-reintentar');

  if (entrada && entrada.dataset.cqVinculado !== '1') {
    entrada.dataset.cqVinculado = '1';
    entrada.addEventListener('input', () => {
      entrada.value = normalizarPlaca(entrada.value).slice(0, 8);
      entrada.removeAttribute('aria-invalid');
    });
    entrada.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') {
        evento.preventDefault();
        form?.requestSubmit();
      }
    });
  }

  const campo4 = porId<HTMLInputElement>('cq-t4');
  if (campo4 && campo4.dataset.cqVinculado !== '1') {
    campo4.dataset.cqVinculado = '1';
    campo4.addEventListener('input', () => {
      campo4.value = campo4.value.replace(/\D/g, '').slice(0, 4);
      campo4.removeAttribute('aria-invalid');
    });
    campo4.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') {
        evento.preventDefault();
        form?.requestSubmit();
      }
    });
  }

  if (form && form.dataset.cqVinculado !== '1') {
    form.dataset.cqVinculado = '1';
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      void buscar(entrada?.value ?? '', porId<HTMLInputElement>('cq-t4')?.value ?? '');
    });
  }

  if (refrescar && refrescar.dataset.cqVinculado !== '1') {
    refrescar.dataset.cqVinculado = '1';
    refrescar.addEventListener('click', () => {
      if (!placaActual) return;
      refrescar.disabled = true;
      refrescar.textContent = 'Actualizando…';
      void buscar(placaActual, t4Actual, { fresco: true }).finally(() => {
        refrescar.disabled = false;
        refrescar.textContent = 'Actualizar ↻';
      });
    });
  }

  if (reintentar && reintentar.dataset.cqVinculado !== '1') {
    reintentar.dataset.cqVinculado = '1';
    reintentar.addEventListener('click', () => {
      if (placaActual) void buscar(placaActual, t4Actual);
    });
  }

  const pestañas = porSel<HTMLElement>('[role="tablist"]', porId('cq-tabs'));
  if (pestañas && pestañas.dataset.cqVinculado !== '1') {
    pestañas.dataset.cqVinculado = '1';
    pestañas.addEventListener('click', (evento) => {
      const boton = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[role="tab"]');
      if (boton?.id) activarTab(boton.id);
    });
    pestañas.addEventListener('keydown', tecladoTabs);
  }

  const viewport = porId('cq-fotos-viewport');
  if (viewport && viewport.dataset.cqVinculado !== '1') {
    viewport.dataset.cqVinculado = '1';
    let pendiente = false;
    viewport.addEventListener(
      'scroll',
      () => {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(() => {
          pendiente = false;
          actualizarCarrusel();
        });
      },
      { passive: true },
    );
  }

  const carrusel = porId('cq-fotos');
  if (carrusel && carrusel.dataset.cqVinculado !== '1') {
    carrusel.dataset.cqVinculado = '1';
    carrusel.addEventListener('click', (evento) => {
      const boton = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-accion]');
      const accion = boton?.dataset.accion;
      if (accion === 'prev') irAFoto(Math.max(0, indiceActualCarrusel() - 1));
      else if (accion === 'next') {
        irAFoto(Math.min(Math.max(fotosActuales.length - 1, 0), indiceActualCarrusel() + 1));
      }
    });
  }

  const visor = porId('cq-visor');
  if (visor && visor.dataset.cqVinculado !== '1') {
    visor.dataset.cqVinculado = '1';
    visor.addEventListener('click', (evento) => {
      const boton = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-accion]');
      const accion = boton?.dataset.accion;
      if (accion === 'cerrar') cerrarVisor();
      else if (accion === 'prev') moverVisor(-1);
      else if (accion === 'next') moverVisor(1);
    });
    const escena = porSel<HTMLElement>('.cq-visor-escena', visor);
    if (escena) vincularGestosDelVisor(escena);
  }
}

let enlacesGlobales = false;

/** Listeners de documento: se registran una sola vez por sesión de página. */
function vincularGlobales(): void {
  if (enlacesGlobales) return;
  enlacesGlobales = true;
  document.addEventListener('keydown', manejarTecladoGlobal);
  // Si el usuario navega fuera con el visor abierto, restaurar el scroll.
  document.addEventListener('astro:before-swap', () => {
    document.documentElement.style.overflow = '';
    const visor = porId('cq-visor');
    if (visor) visor.hidden = true;
  });
}

/* ──────────────────────────────── Arranque ──────────────────────────────────── */

function estadoInicial(): void {
  const parametros = new URLSearchParams(location.search);
  const deEnlace = normalizarPlaca(parametros.get('placa') ?? '');
  const t4Enlace = String(parametros.get('t4') ?? '').replace(/\D/g, '').slice(0, 4);
  const guardada = leerPlacaLocal();
  const entrada = porId<HTMLInputElement>('cq-placa');
  const campo4 = porId<HTMLInputElement>('cq-t4');
  if (entrada) entrada.value = deEnlace || guardada;
  if (campo4 && t4Enlace) campo4.value = t4Enlace;

  if (deEnlace && t4Enlace) {
    // buscar() valida los formatos: si vienen sucios, muestra el aviso.
    void buscar(deEnlace, t4Enlace);
    return;
  }
  if (deEnlace && !placaValida(deEnlace)) {
    // Placa con formato inválido: deja que buscar() muestre el aviso.
    void buscar(deEnlace, t4Enlace);
    return;
  }
  if (deEnlace) campo4?.focus();

  expedienteActual = null;
  placaActual = '';
  mostrarVista('inicio');
}

/**
 * Arranque idempotente del portal: se ejecuta en la carga inicial y en cada
 * navegación del ClientRouter. Si no estamos en /consulta/, no hace nada.
 */
export function initConsulta(): void {
  const pagina = document.querySelector<HTMLElement>('.cq-page');
  if (!pagina) return;

  vincularGlobales();
  if (pagina.dataset.cqListo === '1') return;
  pagina.dataset.cqListo = '1';

  vincular();
  estadoInicial();
}
