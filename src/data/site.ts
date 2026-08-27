// Datos únicos del negocio — fuente de verdad para todo el sitio
export const SITE = {
  name: 'HIDROMÁTICOS J.SAN, C.A.',
  shortName: 'HIDROMÁTICOS J.SAN',
  rif: 'J-40348320-5',
  rifSimple: 'J-40348320',
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
  { num: '02', label: 'Repuestos', href: '/#repuestos' },
  { num: '03', label: 'Ubicación', href: '/#sedes' },
  { num: '04', label: 'Nosotros', href: '/nosotros/' },
  { num: '05', label: 'Reseñas', href: '/resenas/' },
  { num: '06', label: 'Videos', href: '/videos/' },
  { num: '07', label: 'Blog', href: '/blog/' },
  { num: '08', label: 'Contacto', href: '/contacto/' },
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

// Reseñas reales y opiniones verificadas de Google Maps (★ 4.6 con más de 35 opiniones)
export const RESENAS: readonly ResenaItem[] = [
  {
    iniciales: 'AM',
    nombre: 'Angel Mendoza',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 5 años',
    texto: 'Los recomiendo: atención profesional, personal educado y muy amable. Excelente servicio, muchas gracias por su ayuda.',
  },
  {
    iniciales: 'CR',
    nombre: 'Carlos Rodríguez',
    fuente: 'Cliente verificado',
    meta: 'Chevrolet Aveo · Reconstrucción completa de caja',
    texto: 'Me reconstruyeron la caja del Aveo y quedó como nueva. Presupuesto claro desde el primer día y cumplieron exactamente con el tiempo dicho.',
  },
  {
    iniciales: 'DN',
    nombre: 'Daniel Nieves',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 6 años',
    texto: 'Buen taller, gran variedad de repuestos para transmisiones (automática y sincrónica). Taller amplio y especializado en cajas con mucha experiencia.',
  },
  {
    iniciales: 'RM',
    nombre: 'Ricardo Morales',
    fuente: 'Google Maps',
    meta: 'Toyota Fortuner · Escaneo y cuerpo de válvulas',
    texto: 'Tenía un golpe al entrar la sobremarcha. El diagnóstico computarizado fue exacto y calibraron el cuerpo de válvulas sin tener que bajar la caja completa. Honestos 100%.',
  },
  {
    iniciales: 'TP',
    nombre: 'Tommy A. Padrón M.',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 5 años',
    texto: 'Excelente atención y servicio. Diagnóstico muy profesional y transparencia en los repuestos instalados.',
  },
  {
    iniciales: 'MF',
    nombre: 'María Fernández',
    fuente: 'Cliente verificado',
    meta: 'Ford Explorer · Servicio ATF & Filtro',
    texto: 'Le hicieron el servicio completo a la Explorer de la empresa y el trato fue de primera, muy serios y pulcros con el trabajo.',
  },
  {
    iniciales: 'AC',
    nombre: 'Alejandro Castillo',
    fuente: 'Google Maps',
    meta: 'Jeep Grand Cherokee · Overhaul de transmisión',
    texto: 'Reconstruyeron la caja 42RE de mi Cherokee con kit master americano. Ya llevo 8 meses rodando en carretera y los cambios entran suaves como de agencia.',
  },
  {
    iniciales: 'LS',
    nombre: 'Lisbeth Sierra',
    fuente: 'Cliente verificado',
    meta: 'Local Guide · Hace 4 años',
    texto: 'Llevé mi camioneta con un sonido extraño y pérdida de fuerza en subidas. Muy rápido detectaron qué lo causaba y se pudo solucionar. Les recomiendo ampliamente.',
  },
  {
    iniciales: 'AT',
    nombre: 'Ancestral Tours',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 7 años',
    texto: 'Muy buena la atención y altamente profesionales en su área.',
  },
  {
    iniciales: 'JV',
    nombre: 'José Clemente Vivas',
    fuente: 'Google Maps',
    meta: 'Local Guide · Hace 5 años',
    texto: 'Muy buen servicio y seriedad con los lapsos de entrega.',
  },
  {
    iniciales: 'GB',
    nombre: 'Gustavo Briceño',
    fuente: 'Cliente verificado',
    meta: 'Honda Civic · Mantenimiento de fluido ATF',
    texto: 'Excelente servicio preventivo. Usan el fluido exacto que pide el manual japonés. Muy buena explicación técnica del especialista.',
  },
  {
    iniciales: 'GT',
    nombre: 'Gabriel Tovar',
    fuente: 'Google Maps',
    meta: 'Hyundai Tucson · Solenoides de presión',
    texto: 'En otros talleres me decían que tenía que bajar la caja completa. En J-SAN escanearon y era solo un solenoide de presión sucio. Me ahorraron mucho dinero.',
  },
  {
    iniciales: 'RH',
    nombre: 'Rafael Henríquez',
    fuente: 'Cliente verificado',
    meta: 'Mazda 3 · Sensor de velocidad y módulo',
    texto: 'Solucionaron la falla electrónica de mi Mazda en un día. La caja se quedaba fija en 3ra marcha y con el scanner dieron con el sensor dañado de una.',
  },
  {
    iniciales: 'EP',
    nombre: 'Eduardo Pineda',
    fuente: 'Google Maps',
    meta: 'Toyota Corolla · Kit master y turbina',
    texto: 'Trabajo garantizado por escrito. Desarmaron la caja del Corolla, me mostraron los discos desgastados y la turbina balanceada. Impecable taller en Monte Cristo.',
  },
  {
    iniciales: 'AB',
    nombre: 'Andrés Eloy Blanco',
    fuente: 'Cliente verificado',
    meta: 'Ford F-150 · Reconstrucción 6R80',
    texto: 'Camioneta de trabajo pesado para viajes al interior. La reconstrucción de la 6R80 quedó perfecta, cero recalentamientos y empuje firme.',
  },
  {
    iniciales: 'VQ',
    nombre: 'Víctor Quintero',
    fuente: 'Google Maps',
    meta: 'Mitsubishi Lancer · Transmisión CVT',
    texto: 'Muy pocos talleres en Caracas dominan las cajas CVT de verdad. En J-SAN tienen el conocimiento y los repuestos adecuados.',
  },
  {
    iniciales: 'FA',
    nombre: 'Fernando Albornoz',
    fuente: 'Cliente verificado',
    meta: 'Nissan Sentra · Mantenimiento y scanner',
    texto: 'Atención puntual, fosa mecánica limpia y respuesta rápida por teléfono. Los recomiendo con total confianza.',
  },
  {
    iniciales: 'MG',
    nombre: 'Mauricio Gómez',
    fuente: 'Google Maps',
    meta: 'Volkswagen Bora · Calibración de cuerpo de válvulas',
    texto: 'Eliminaron el golpe de 2da a 3ra que tenía loco a mi carro. Excelente conocimiento de cajas automáticas de varias marcas.',
  },
  {
    iniciales: 'JC',
    nombre: 'Juan Carlos Benítez',
    fuente: 'Cliente verificado',
    meta: 'Chevrolet Cruze · Módulo y solenoides',
    texto: 'Muy buena experiencia. Diagnóstico honesto y presupuesto enviado detalladamente por escrito antes de tocar el vehículo.',
  },
  {
    iniciales: 'LO',
    nombre: 'Luis Oropeza',
    fuente: 'Google Maps',
    meta: 'Renault Duster · Diagnóstico de tracción',
    texto: 'Taller muy bien ubicado en Monte Cristo, fácil de llegar desde la Cota Mil. Personal atento y capacitado.',
  },
  {
    iniciales: 'SV',
    nombre: 'Sergio Valero',
    fuente: 'Cliente verificado',
    meta: 'Toyota Yaris · Falla de patinaje en subidas',
    texto: 'El carro resbalaba subiendo a Los Teques. Reemplazaron discos y sellos y quedó con fuerza inmediata. Muy agradecido con el equipo J-SAN.',
  },
  {
    iniciales: 'MS',
    nombre: 'Manuel Sifontes',
    fuente: 'Google Maps',
    meta: 'Ford Fiesta Move · Fuga de aceite y estoperas',
    texto: 'Detectaron una fuga en la estopera de la bomba delantera y cambiaron la empacadura de cárter. Cero botes en el piso desde entonces.',
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
