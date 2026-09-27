/**
 * GET /api/recepcion-form?t=<firma>
 *
 * Redirige al formulario oficial de recepción SOLO con una firma HMAC válida
 * (emitida por /api/recepcion-acceso tras pasar Turnstile; vida 10 minutos).
 * Así la URL real del formulario no aparece en el HTML ni en el JS del sitio.
 */
import { urlFormulario, validarAcceso } from './_lib/recepcion.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'metodo_no_permitido' });
    return;
  }

  const destino = urlFormulario();
  if (!destino) {
    res.status(503).json({
      ok: false,
      error: 'no_configurado',
      mensaje: 'El formulario no está disponible en este momento. Escríbenos por WhatsApp.',
    });
    return;
  }

  const url = new URL(req.url, 'http://interno');
  const t = String(req.query?.t ?? url.searchParams.get('t') ?? '');
  if (!validarAcceso(t)) {
    res.status(403).json({
      ok: false,
      error: 'token_invalido',
      mensaje:
        'El enlace expiró o no es válido. Vuelve a la página de recepción y completa la verificación.',
    });
    return;
  }

  res.statusCode = 302;
  res.setHeader('Location', destino);
  res.end();
}
