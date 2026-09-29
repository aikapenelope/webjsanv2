/**
 * Reintento mínimo para operaciones de red del proxy de fotos: un segundo
 * intento ante fallos transitorios (timeouts, cortes, 5xx) sin esperas
 * artificiales. La firma de Lark se renueva en cada intento porque el
 * llamador reconstruye toda la operación.
 */
export async function conReintento(operacion, intentos = 2) {
  let ultimoError;
  for (let intento = 0; intento < intentos; intento++) {
    try {
      return await operacion();
    } catch (err) {
      ultimoError = err;
    }
  }
  throw ultimoError;
}
