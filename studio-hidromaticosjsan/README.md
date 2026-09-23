# Panel de Artículos y Blog · Hidromáticos J-SAN (Sanity Studio)

Este directorio contiene el panel de gestión de contenidos (CMS) de **Hidromáticos J-SAN**, impulsado por [Sanity.io](https://sanity.io).

Permite que el dueño del taller redacte, edite y publique artículos técnicos y guías de cajas automáticas de forma 100% visual desde cualquier computadora o tablet, sin depender de programadores ni tocar código.

---

## 🛠️ Comandos Disponibles

Desde la raíz del repositorio (`webjsanv2`):

- **Iniciar el Studio en local:**
  ```bash
  npm run studio:dev
  ```
  Abre el panel en `http://localhost:3333`.

- **Construir el Studio:**
  ```bash
  npm run studio:build
  ```

- **Desplegar a la nube gratuita de Sanity:**
  ```bash
  npm run studio:deploy
  ```
  Le asignará una URL en la nube pública (ej: `hidromaticosjsan.sanity.studio`).

---

## 🚀 Guía de Puesta en Producción

### 1. Desplegar el Studio en la nube
Ejecuta en tu terminal:
```bash
cd studio-hidromaticosjsan
npx sanity deploy
```
Te pedirá elegir un subdominio (por ejemplo: `hidromaticosjsan`).  
Una vez listo, el panel estará disponible en:  
👉 `https://hidromaticosjsan.sanity.studio`

---

### 2. Dar acceso al dueño del taller
1. Entra en [sanity.io/manage](https://www.sanity.io/manage) con tu cuenta.
2. Selecciona el proyecto **`6ezakoyw`**.
3. Ve a la pestaña **Members** (Miembros) y haz clic en **Invite Member**.
4. Escribe el correo del cliente (`hidromaticosjsan@gmail.com`).
5. Asigna el rol **Editor** (o Administrator si deseas que gestione todo).
6. Al cliente le llegará un correo para ingresar directamente con Google o email.

---

### 3. Conectar la publicación automática con Vercel (Webhook)

Para que cuando el cliente presione **"Publish"** en Sanity la página web se actualice sola en Vercel en ~20 segundos:

#### Paso A: Crear Deploy Hook en Vercel
1. Ve a tu proyecto en el panel de **Vercel** (`webjsanv2`).
2. Entra en **Settings** → **Git** → sección **Deploy Hooks**.
3. Haz clic en **Create Hook**:
   - **Name:** `Sanity Blog Publish`
   - **Branch:** `main` (o la rama de producción activa)
4. Haz clic en **Create** y copia la URL generada (ej: `https://api.vercel.com/v1/integrations/deploy/prj_...`).

#### Paso B: Pegar el Webhook en Sanity
1. En [sanity.io/manage](https://www.sanity.io/manage), entra al proyecto `6ezakoyw`.
2. Ve a **API** → sección **Webhooks** → **Create webhook**.
3. Configura:
   - **Name:** `Vercel Auto Deploy`
   - **URL:** *(Pega la URL del Deploy Hook de Vercel que copiaste en el Paso A)*
   - **Dataset:** `production`
   - **Trigger on:** `Create`, `Update`, `Delete`
   - **Filter:** `_type == "post"`
4. Guarda el webhook. ¡Listo! Cada vez que se cree o modifique un artículo, la web se actualizará automáticamente.
