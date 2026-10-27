# Sitio web público — Plásticos Espinal

Página de presentación del negocio (una sola página, HTML/CSS/JS puro, sin
dependencias externas). Diseño 4: **«hermana del CRM, más sobria»** (oct 2026).

## Diseño

- **Cabecera:** una cápsula azul noche con la cinta roja y azul como borde y
  olas tenues por dentro (`img/ondas.svg`). Logo al centro en su caja blanca;
  a la izquierda el teléfono y a la derecha **«Pida ahora»** (WhatsApp), el
  gemelo del botón «Vender» del CRM. El menú va debajo, en pastillas
  centradas. Desde 1120 px la cabecera queda fija.
- **Página clara:** secciones alternas `#eef2fc` / blanco; títulos de sección
  en Archivo Black en mayúsculas sobre una línea de 2 px; el producto manda.
- **Sin animaciones de entrada.** Lo interactivo solo sube 1 px al pasar el
  mouse y se hunde al tocarlo; con `prefers-reduced-motion`, ni eso.
- **Colores de uso:**
  - azul noche `#0e1a47`: cápsula, bloque de teléfono en Contacto y pie;
  - azul `#1e49b8`: enlaces, íconos y pastilla del menú activo;
  - verde `#0f7a43`: todos los botones de WhatsApp del cuerpo y la línea
    ecológica;
  - amarillo `#ffc933`: solo acción o cifra («Pida ahora», el número de
    WhatsApp en Contacto y «Saltar al contenido»), nunca decoración;
  - rojo `#e63927`: solo en la cinta (cápsula y filo del pie); el texto rojo
    usa `#c42b1c`.
- Todo el texto va en **usted** («Pida», «Pregunte», «Conozca»).

## Dónde vive

- **Esta carpeta** (`plasticos-espinal-web/`, en el Escritorio dentro de
  "Plasticos Espinal") es el repositorio real del sitio.
- **GitHub**: <https://github.com/johanmontealegre13/plasticos-espinal-web>
  (rama `main`).
- **Hosting**: Cloudflare Pages (proyecto `plasticos-espinal-web`), que
  publica solo cada `git push` a `main`. Lee `_headers` tal cual.
- **Dominio en producción**: <https://plasticosespinal.com> (se configura en
  el panel de Cloudflare, no en el repositorio).
- El CRM es un proyecto aparte: `~/PlasticosEspinal-CRM` (Flask; ver su
  `CLAUDE.md`).

## Ver el sitio en el computador

```bash
python3 -m http.server 5500 --directory "/Users/johanmontealegrep/Desktop/Plasticos Espinal/plasticos-espinal-web"
```

Luego abre <http://localhost:5500/>.

## Publicar un cambio

1. Edita los archivos **en una rama**, no en `main`: lo que llega a `main`
   sale al aire en ~1 minuto (Cloudflare Pages).
2. Si tocaste un CSS o JS, sube su `?v=N` en todas las páginas que lo piden.
   `_headers` los guarda 7 días en caché; sin subir el número, los visitantes
   siguen viendo la versión vieja. `node pruebas/versiones.mjs` dice cuál
   falta, y la revisión automática lo exige.
3. Si cambias el script embebido de `index.html`, recalcula su huella
   `sha256` en la CSP de `index.html`, `404.html`, `_headers` y `.htaccess`
   (la prueba que falla dice cuál es la huella nueva).
4. Corre la revisión (abajo), abre un PR y fusiona cuando salga en verde.

## Pruebas y revisión automática

Viven en `pruebas/` (no en la raíz a propósito: un `package.json` en la raíz
haría que Cloudflare instale dependencias y podría publicar `node_modules`).

```bash
cd pruebas
npm ci                 # la primera vez
npm run check          # lint + tipos + pruebas rápidas + navegador
node versiones.mjs     # ¿subí el ?v= de lo que cambié? (frente a origin/main)
npm run mutaciones     # rompe a propósito partes críticas en una copia y
                       # comprueba que alguna prueba lo atrapa
```

| Qué | Dónde |
|---|---|
| Enlaces, CSP, caché, regresiones de contenido | `pruebas/unit/sitio.test.mjs` |
| Que `tienda/catalogo.json` esté bien escrito | `pruebas/unit/catalogo.test.mjs` |
| Candado de la tienda (contraseña, galleta, noindex) | `pruebas/unit/candado.test.mjs` |
| Intermediario de Mi cuenta (clave del CRM, galletas, rutas) | `pruebas/unit/mi-cuenta.test.mjs` |
| La lógica de cada función de la tienda (llegada, buscador, guardados, GPS, vendedor) | `pruebas/unit/*.test.mjs` con su nombre |
| Canasta y domicilio | `pruebas/e2e/tienda.spec.js` |
| Cada función de la tienda en Chromium | `pruebas/e2e/*.spec.js` con su nombre |
| Mi cuenta (entrar, crear cuenta, pedidos, datos) | `pruebas/e2e/mi-cuenta.spec.js` |
| Inicio y 404 en Chromium, con las cabeceras reales de `_headers` | `pruebas/e2e/inicio.spec.js` |

GitHub Actions (`.github/workflows/revision.yml`) corre todo en cada PR y en
cada push a `main`. Cloudflare publica `main` sin esperarla: para que nada
roto llegue al aire, en GitHub se marca «Revisión del sitio» como obligatoria
(Settings > Branches > main).

## ✏️ Datos pendientes de mejorar

1. **Reseñas reales** — la sección «Por qué nos eligen» (`#resenas`) no
   muestra testimonios: solo invita a dejar reseña en Google. Cuando haya
   reseñas reales (con permiso) o ficha de Google Business Profile, pueden
   sumarse ahí.
2. **Presentaciones de venta** — cuando se definan ("paca x100", "desde 1
   caja"), añadirlas a las tarjetas del catálogo; también un bloque "Los más
   pedidos" con productos concretos.

## Estructura de archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página completa (portada, marcas, catálogo, sectores, línea ecológica, nosotros, por qué nos eligen, preguntas, contacto) |
| `css/estilos.css` | Todos los estilos (sistema «hermana del CRM, más sobria»; colores del `:root` del CRM) |
| `js/principal.js` | JS mínimo con `defer` (año del pie, sombra de la cabecera, menú activo, burbuja de WhatsApp); el sitio funciona sin JavaScript |
| `img/` | Logo restaurado en SVG (`logo-color.svg`, el mismo del manual de marca), favicons, fotos de producto, `ondas.svg` (relleno de la cápsula) y `og-image.jpg` |
| `favicon.ico`, `site.webmanifest` | Iconos del navegador y de "agregar a pantalla de inicio" |
| `robots.txt`, `sitemap.xml` | Para Google |
| `_headers` | Cabeceras de seguridad y caché que aplica Cloudflare Pages |
| `404.html` | Página de error con la cápsula, «Volver al inicio» y pedido por WhatsApp (rutas desde la raíz) |
| `pruebas/` | Pruebas automáticas y herramientas de revisión (no hacen parte de la página) |
| `.github/workflows/` | Revisión automática en GitHub |

## Secciones de la página

1. **Portada**: titular, doble CTA (WhatsApp + «Ver catálogo»), ficha de tres
   datos y foto de la bodega.
2. **Marcas** que distribuimos, en lista estática.
3. **Catálogo** — 10 categorías; cada tarjeta abre una cotización por WhatsApp
   con mensaje precargado propio.
4. **Sectores** (restaurantes, panaderías, comidas rápidas…).
5. **Línea ecológica** en verde.
6. **Nosotros** con tres cifras.
7. **Por qué nos eligen** (`#resenas`) y enlace para dejar reseña en Google.
8. **Preguntas** — `details` nativos + datos `FAQPage` (el texto visible debe
   seguir siendo espejo exacto del JSON-LD) y los términos del domicilio.
9. **Contacto**: WhatsApp, dirección, horario, teléfono y enlace al mapa.

## Seguridad

- `_headers` (Netlify/Cloudflare Pages) y `.htaccess` (Apache/cPanel) con:
  CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS y caché. **Mantener ambos archivos sincronizados.**
- `<meta http-equiv="Content-Security-Policy">` en `index.html` como respaldo.
- La página ya no tiene script inline; el hash SHA-256 que sigue en la CSP
  es del script del diseño 3 y no estorba. Si algún día se agrega uno,
  calcula su hash:
  `printf "NUEVO_SCRIPT" | openssl dgst -sha256 -binary | openssl base64`
  y actualízalo en `_headers`, `.htaccess` y la meta CSP.
- `.well-known/security.txt` con contacto para reportes de seguridad.

## Cumplimiento de la Front-End Checklist

Título <65 caracteres, descripción <160, favicons completos, Open Graph +
Twitter Card, `lang="es"`, un solo H1 con jerarquía correcta, HTML semántico,
`rel="noopener"` en todos los `target="_blank"`, `alt` en todas las imágenes,
enlace "saltar al contenido", `:focus-visible`, `prefers-reduced-motion`, datos
estructurados JSON-LD (negocio local + FAQ), sitemap y robots. Cero peticiones
externas, JS con `defer`, sin errores en consola. Contrastes AA verificados en
los pares principales de la paleta. Probado en escritorio y móvil.

## Historial de diseños

1. **Diseño 1** — primera versión.
2. **Diseño 2 "Cartel de plaza"** — azul noche, stickers rotados, sombras
   duras de imprenta (respaldo en `../respaldo-diseno-20260814_191840/`).
3. **Diseño 3 "Mercado de día"** (ago 2026) — claro y comercial,
   basado en el lenguaje visual del sector mayorista (Darnel, Carvajal, MAHA).
   Direcciones alternativas documentadas en `../analisis-rediseno-2026/`.
4. **Diseño 4 «hermana del CRM, más sobria»** (actual, oct 2026) — la cápsula
   y los botones del CRM sin su lado festivo (morado, neón, vidrio,
   animaciones de entrada).

## Tienda en línea (`/tienda`, en pruebas y con contraseña)

- Vive en `tienda/` y se abre en `plasticosespinal.com/tienda`. Mientras está
  en pruebas **no tiene enlaces desde el sitio** y la cuida
  `functions/tienda/_middleware.js` (Cloudflare Pages Functions): pide la
  contraseña de prueba, deja una galleta de 30 días y marca todo `noindex`.
  La contraseña no está en el código, solo su huella (cómo cambiarla: ver el
  comentario del archivo). Al abrirla al público se borra SOLO
  `functions/tienda/_middleware.js` (no la carpeta: ahí vive el portal del cliente).
- **Portal del cliente** (`tienda/mi-cuenta/`): «Mi cuenta» en la cabecera
  despliega un panel pequeño (Mis pedidos, Mis datos, Salir). El cliente crea su
  cuenta (nombre, cédula, celular), confirma su WhatsApp escribiendo el código
  que le manda la tienda (o, si el CRM está en «cliente_escribe», mandándonos
  el que le muestra la página) y pone su contraseña; después entra con cédula o celular + contraseña, y «Olvidé mi
  contraseña» repite la confirmación por WhatsApp. Ve sus compras de tienda y
  mostrador, descarga el recibo PDF y edita nombre, barrio, dirección e
  indicaciones (celular y documento NO: son la llave).
  Los datos vienen del CRM a través de `functions/tienda/mi-cuenta/api/[[ruta]].js`,
  el ÚNICO que habla con el CRM: le pone la clave `PORTAL_CLAVE` (secreto de
  Cloudflare Pages, el mismo valor del `.env` del CRM) y guarda la sesión del
  cliente en una galleta HttpOnly. Sin ese secreto el portal dice que no pudo
  traer los datos (el secreto va en Production y solo se carga en la siguiente
  publicación). El navegador nunca ve la dirección del CRM.
- Diseño «tienda primero»: búsqueda y canasta arriba, categorías en fotos,
  combo, lo más pedido y compra por tipo de negocio; Plásticos Espinal queda en
  el logo y el pie.
- Foto de cada producto: la que tiene en el CRM. El catálogo trae su `foto`
  (nombre del archivo) y la imagen pasa por el intermediario
  (`/tienda/mi-cuenta/api/tienda/foto/<archivo>`), así que sale en la tienda
  sola en cuanto se sube al CRM. Sin foto, la de su categoría.
- Los productos, precios, disponibilidad y domicilio salen del CRM (por el
  intermediario `/tienda/mi-cuenta/api/tienda/catalogo`): la tienda no tiene
  precios propios.
- `tienda/catalogo.json` trae solo lo de la página y Johan lo cambia a mano.
  Todo es opcional: si una clave falta, queda mal escrita o el archivo no
  carga, la tienda sigue sin eso (sin horario, por ejemplo, queda el texto fijo
  de la franja). Su `nota` repite esta explicación para quien abre el archivo.
  - `whatsapp`: el número entre comillas, solo dígitos y con el 57 adelante.
  - `pago`: `qr` (la imagen del QR Bre-B) y `llave` (el texto de la llave).
  - `categorias`: la foto de cada categoría (`id`, `nombre`, `imagen`); va a
    la categoría del CRM cuyo nombre lleva la primera palabra de este.
  - `horario.alistar_min`: los minutos que tarda en alistar y llevar un pedido,
    contando solo los minutos en que la tienda está abierta.
  - `horario.dias`: los tramos abiertos de cada día, como
    `[["08:00", "12:30"], ["14:00", "18:30"]]`: hora de 24 (`HH:MM`) y la de
    abrir antes que la de cerrar. Los días van en minúscula y sin tilde
    (`domingo`, `lunes`, `martes`, `miercoles`, `jueves`, `viernes`, `sabado`);
    un día que no está, o con `[]`, no abre.
  - `horario.festivos`: las fechas de los festivos, `"AAAA-MM-DD"`. **Hay que
    renovar la lista cada año**: la que trae hoy llega hasta el 2027-12-25, y
    después de la última fecha la tienda trata los festivos como días normales.
  - `horario.festivo`: el día de `dias` con cuyo horario se atiende en
    festivo, entre comillas (`"domingo"`). Sin esta clave, en festivo no se
    atiende.
  - `sinonimos`: `"palabra": ["otra", "otra más"]`. Quien busca la palabra
    (una sola) también ve los productos que tienen alguna de las otras. Va en
    **un solo sentido**: para que valga al revés, se escribe también al revés.
  - `entrega`: el punto de la tienda (`tienda.lat`, `tienda.lng`) y
    `radio_km`, hasta dónde en línea recta se acepta la ubicación del GPS del
    cliente (solo El Espinal). Números sin comillas.
  - `vendedor`: quién vende, como pide la Ley 1480 (`nombre`, `documento`,
    `direccion`, `telefono`, `correo`), entre comillas. Sale en el pie de la
    tienda y en los términos; lo vacío (`""`) no se muestra.
- Después de cambiar el archivo: `cd pruebas && npm test`.
  `unit/catalogo.test.mjs` es la única prueba que lee el archivo de verdad y
  dice en palabras qué quedó mal escrito; las demás usan copias congeladas
  (`pruebas/unit/fixtures/` y `SITIO_FIJO` en `pruebas/e2e/ayudas.js`), así
  que cambiar una hora, un festivo o un sinónimo no las pone rojas.
- La canasta se guarda en el navegador; «Pedir ya» manda el pedido al CRM
  «Por confirmar» (el CRM pone precios y domicilio) y luego se paga con el QR
  Bre-B o en efectivo.
