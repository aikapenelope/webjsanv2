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
  { num: '04', label: 'Reseñas', href: '/resenas/' },
  { num: '05', label: 'Nosotros', href: '/nosotros/' },
  { num: '06', label: 'Contacto', href: '/contacto/' },
] as const;

export const MARCAS = [
  'toyota','chevrolet','ford','hyundai','nissan','kia','mitsubishi','jeep',
  'volkswagen','mercedes','honda','mazda','suzuki','subaru','renault','dacia',
] as const;
