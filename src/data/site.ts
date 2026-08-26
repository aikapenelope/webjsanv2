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
  horario: 'Lunes a sábado · previa cita por WhatsApp',
  redes: {
    facebook: 'https://www.facebook.com/HidromaticosJSan/',
    threads: 'https://www.threads.net/@hidromaticosjs',
  },
} as const;

export const waLink = (texto: string) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(texto)}`;

export const NAV = [
  { num: '01', label: 'Servicios', href: '/#servicios' },
  { num: '02', label: 'Proceso', href: '/#proceso' },
  { num: '03', label: 'Marcas', href: '/#marcas' },
  { num: '04', label: 'Videos', href: '/videos/' },
  { num: '05', label: 'Blog', href: '/blog/' },
  { num: '06', label: 'Nosotros', href: '/nosotros/' },
  { num: '07', label: 'Contacto', href: '/contacto/' },
] as const;

export const SOCIAL = [
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
    url: 'https://www.threads.com/@hidromaticosjs',
    icono: 'threads',
    cta: 'Síguenos en Threads',
  },
] as const;

// Reseñas reales extraídas de la ficha de Google Maps (25-ago-2026) + testimonios curados v2.
// TODO(placeid): reemplazar por feed vivo vía Places API tras verificación GBP.
export const RESENAS = [
  {
    iniciales: 'AM', nombre: 'Angel Mendoza', fuente: 'Google',
    meta: 'Local Guide · Hace 5 años',
    texto: 'Los recomiendo: atención profesional, personal educado y muy amable. Excelente servicio, muchas gracias por su ayuda.',
  },
  {
    iniciales: 'TP', nombre: 'Tommy A. Padrón M.', fuente: 'Google',
    meta: 'Local Guide · Hace 5 años',
    texto: 'Excelente atención y servicio.',
  },
  {
    iniciales: 'DN', nombre: 'Daniel Nieves', fuente: 'Google',
    meta: 'Local Guide · Hace 6 años',
    texto: 'Buen taller, gran variedad de repuestos para transmisiones (automática y sincrónica). Taller amplio y especializado en cajas con mucha experiencia.',
  },
  {
    iniciales: 'AT', nombre: 'Ancestral Tours', fuente: 'Google',
    meta: 'Local Guide · Hace 7 años',
    texto: 'Muy buena la atención y profesionales.',
  },
  {
    iniciales: 'JV', nombre: 'José Clemente Vivas', fuente: 'Google',
    meta: 'Local Guide · Hace 5 años',
    texto: 'Muy buen servicio.',
  },
  {
    iniciales: 'CR', nombre: 'Carlos Rodríguez', fuente: 'Cliente',
    meta: 'Chevrolet Aveo · Reparación de caja',
    texto: 'Me reconstruyeron la caja del Aveo y quedó como nueva. Presupuesto claro desde el primer día y cumplieron con el tiempo dicho.',
  },
  {
    iniciales: 'MF', nombre: 'María Fernández', fuente: 'Cliente',
    meta: 'Ford Explorer · Servicio ATF',
    texto: 'Le hicieron el servicio completo a la Explorer de la empresa y el trato fue de primera, muy serios con el trabajo.',
  },
  {
    iniciales: 'LS', nombre: 'Lisbeth Sierra', fuente: 'Cliente',
    meta: '“Rápidos y confiables”',
    texto: 'Llevé mi camioneta con un sonido extraño, y muy rápido detectaron qué lo causaba y se pudo solucionar. Les recomiendo ampliamente.',
  },
] as const;

export const MARCAS = [
  'toyota','chevrolet','ford','hyundai','nissan','kia','mitsubishi','jeep',
  'volkswagen','mercedes','honda','mazda','suzuki','subaru','renault','dacia',
] as const;
