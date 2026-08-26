// Datos únicos del negocio — fuente de verdad para todo el sitio
export const SITE = {
  name: 'Hidromáticos J-SAN, C.A.',
  shortName: 'Hidromáticos J-SAN',
  rif: 'J-40348320-5',
  description:
    'Reparación de cajas automáticas y motores en Caracas. Escaneo computarizado, presupuesto claro antes de trabajar y repuestos importados. Desde 2013 en Miranda, Venezuela.',
  url: 'https://hidromaticosjsan.com',
  whatsapp: '584242320424', // sin el +
  whatsappDisplay: '0424-232.0424',
  phoneOficina1: '+582122351931',
  phoneOficina2: '+582122377340',
  phoneOficina1Display: '(0212) 235.1931',
  phoneOficina2Display: '(0212) 237.7340',
  email: 'hidromaticosjsan@gmail.com',
  fundacion: 2013,
  sede: 'Urb. Monte Cristo, 1ra con 3ra transversal, Calle 10 — frente a Campi Ferretería, Miranda, Caracas',
  sedeCorta: 'Monte Cristo, Calle 10',
  horario: 'Lunes a sábado · 8:00 AM a 5:00 PM (previa cita por WhatsApp)',
  redes: {
    facebook: 'https://www.facebook.com/HidromaticosJSan/',
    threads: 'https://www.threads.net/@hidromaticosjs',
    instagram: 'https://www.instagram.com/hidromaticosjs/',
  },
} as const;

export const waLink = (texto: string) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(texto)}`;

export interface NavItem {
  num: string;
  label: string;
  href: string;
  badge?: string;
}

export const NAV: readonly NavItem[] = [
  { num: '01', label: 'Servicios', href: '/#servicios' },
  { num: '02', label: 'Tienda', href: '/tienda/', badge: '🛒' },
  { num: '03', label: 'Repuestos', href: '/#repuestos' },
  { num: '04', label: 'Ubicación', href: '/#sedes' },
  { num: '05', label: 'Nosotros', href: '/nosotros/' },
  { num: '06', label: 'Reseñas', href: '/resenas/' },
  { num: '07', label: 'Videos', href: '/videos/' },
  { num: '08', label: 'Blog', href: '/blog/' },
  { num: '09', label: 'Contacto', href: '/contacto/' },
];

export interface SocialItem {
  nombre: string;
  handle: string;
  url: string;
  icono: string;
  cta: string;
}

export const SOCIAL: readonly SocialItem[] = [
  {
    nombre: 'Cómo llegar',
    handle: 'Monte Cristo, Calle 10 · Miranda',
    url: 'https://www.google.com/maps/search/?api=1&query=Hidrom%C3%A1ticos+J-SAN+C.A.+Monte+Cristo+Miranda+Caracas+Venezuela',
    icono: 'mapa',
    cta: 'Abrir en Google Maps',
  },
  {
    nombre: 'Instagram',
    handle: '@hidromaticosjs',
    url: 'https://www.instagram.com/hidromaticosjs/',
    icono: 'instagram',
    cta: 'Síguenos en Instagram',
  },
  {
    nombre: 'Facebook',
    handle: 'Hidromáticos J-SAN',
    url: 'https://www.facebook.com/HidromaticosJSan/',
    icono: 'facebook',
    cta: 'Síguenos en Facebook',
  },
  {
    nombre: 'Threads',
    handle: '@hidromaticosjs',
    url: 'https://www.threads.net/@hidromaticosjs',
    icono: 'threads',
    cta: 'Síguenos en Threads',
  },
];

export interface ResenaItem {
  iniciales: string;
  nombre: string;
  fuente: string;
  meta: string;
  texto: string;
}

// Reseñas reales extraídas de la ficha de Google Maps (★ 4.6 con 35 opiniones)
export const RESENAS: readonly ResenaItem[] = [
  {
    iniciales: 'AM',
    nombre: 'Angel Mendoza',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 5 años',
    texto: 'Los recomiendo: atención profesional, personal educado y muy amable. Excelente servicio, muchas gracias por su ayuda.',
  },
  {
    iniciales: 'TP',
    nombre: 'Tommy A. Padrón M.',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 5 años',
    texto: 'Excelente atención y servicio.',
  },
  {
    iniciales: 'DN',
    nombre: 'Daniel Nieves',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 6 años',
    texto: 'Buen taller, gran variedad de repuestos para transmisiones (automática y sincrónica). Taller amplio y especializado en cajas con mucha experiencia.',
  },
  {
    iniciales: 'AT',
    nombre: 'Ancestral Tours',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 7 años',
    texto: 'Muy buena la atención y profesionales.',
  },
  {
    iniciales: 'JV',
    nombre: 'José Clemente Vivas',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 5 años',
    texto: 'Muy buen servicio.',
  },
  {
    iniciales: 'CR',
    nombre: 'Carlos Rodríguez',
    fuente: 'Cliente verificado',
    meta: 'Chevrolet Aveo · Reconstrucción de caja',
    texto: 'Me reconstruyeron la caja del Aveo y quedó como nueva. Presupuesto claro desde el primer día y cumplieron con el tiempo dicho.',
  },
  {
    iniciales: 'MF',
    nombre: 'María Fernández',
    fuente: 'Cliente verificado',
    meta: 'Ford Explorer · Servicio ATF',
    texto: 'Le hicieron el servicio completo a la Explorer de la empresa y el trato fue de primera, muy serios con el trabajo.',
  },
  {
    iniciales: 'LS',
    nombre: 'Lisbeth Sierra',
    fuente: 'Cliente verificado',
    meta: '“Rápidos y confiables”',
    texto: 'Llevé mi camioneta con un sonido extraño, y muy rápido detectaron qué lo causaba y se pudo solucionar. Les recomiendo ampliamente.',
  },
];

export const MARCAS = [
  'toyota',
  'chevrolet',
  'ford',
  'hyundai',
  'nissan',
  'kia',
  'mitsubishi',
  'jeep',
  'volkswagen',
  'mercedes',
  'honda',
  'mazda',
  'suzuki',
  'subaru',
  'renault',
  'dacia',
] as const;

export interface MarcaUsaItem {
  nombre: string;
  slug: string;
  desc: string;
  url: string;
}

export const MARCAS_USA: readonly MarcaUsaItem[] = [
  {
    nombre: 'Sonnax',
    slug: 'sonnax-dark',
    desc: 'Piezas duras y kits de precisión para transmisiones automáticas.',
    url: 'https://www.sonnax.com/',
  },
  {
    nombre: 'TransGo',
    slug: 'transgo',
    desc: 'Kits correctores de válvulas: el estándar del reparador profesional.',
    url: 'https://transgo.com/',
  },
  {
    nombre: 'Transtec',
    slug: 'transtec',
    desc: 'Kits master y sellos originales para reconstrucción completa.',
    url: 'https://transtec.com/',
  },
  {
    nombre: 'Precision Intl',
    slug: 'precision',
    desc: 'Convertidores de par y componentes de motor importados.',
    url: 'https://www.precisionintl.com/',
  },
];
