# Sitio web público — Plásticos Espinal

Página de presentación del negocio con su catálogo sin precios (HTML/CSS/JS puro, sin
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
  - rojo `#e63927`: solo en la cinta (arriba de la cabecera y del pie); el
    texto rojo y los filos rojos usan `#c42b1c`.
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
| La puerta de la tienda (nadie entra sin cuenta, subdominio, noindex) | `pruebas/unit/candado.test.mjs` |
| Intermediario de Mi cuenta (clave del CRM, galletas, rutas) | `pruebas/unit/mi-cuenta.test.mjs` |
| La lógica de cada función de la tienda (llegada, buscador, guardados, GPS, vendedor) | `pruebas/unit/*.test.mjs` con su nombre |
| Canasta y domicilio | `pruebas/e2e/tienda.spec.js` |
| Cada función de la tienda en Chromium | `pruebas/e2e/*.spec.js` con su nombre |
| La entrada (bienvenida, crear cuenta, entrar, olvidé) y Mi cuenta (pedidos, datos) | `pruebas/e2e/mi-cuenta.spec.js` |
| La tienda con cuenta (precio por cantidad, datos de entrega de la cuenta) | `pruebas/e2e/con-cuenta.spec.js` |
| Inicio y 404 en Chromium, con las cabeceras reales de `_headers` | `pruebas/e2e/inicio.spec.js` |

GitHub Actions (`.github/workflows/revision.yml`) corre todo en cada PR y en
cada push a `main`. Cloudflare publica `main` sin esperarla: para que nada
roto llegue al aire, en GitHub se marca «Revisión del sitio» como obligatoria
(Settings > Branches > main).

## ✏️ Datos pendientes de mejorar

1. **Reseñas reales** — «Nosotros» solo invita a dejar reseña en Google.
   Cuando haya reseñas reales (con permiso) o ficha de Google Business
   Profile, pueden sumarse ahí.
2. **Fotos del local** — las escenas de `img/escenas/` son de referencia,
   hechas con IA (ver su `CREDITS.txt`). Seis ya muestran productos de verdad
   (repostería, heladería y salsas en el mosaico por negocio; portacomidas,
   bolsas de papel y moldes de aluminio en las categorías): se hicieron con la
   foto real de cada producto como referencia. Las demás son genéricas. Del
   local solo hay capturas de videos y maquetas con gente inventada, y esas no
   se muestran como el local. Una foto real entra con nombre nuevo, cambiado
   en `index.html`. Lo visual del catálogo lo ponen las fotos en uso de cada
   producto (ver «Catálogo público»).
3. **Presentaciones de venta** — cuando se definan ("paca x100", "desde 1
   caja"), añadirlas a las tarjetas del catálogo; también un bloque "Los más
   pedidos" con productos concretos.

## Estructura de archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página completa (franja, cabecera, portada, marcas, categorías en carrusel, mosaico por negocio, banners mayorista y ecológico, confianza, nosotros, preguntas, contacto) |
| `css/estilos.css` | Todos los estilos («vitrina de mostrador»: patrones de tienda grande con los colores del `:root` del CRM) |
| `js/principal.js` | JS mínimo con `defer` (año del pie, sombra de la cabecera, menú activo, aparecer al bajar, el carrusel con flechas, puntos y pausa, y la pausa de la cinta de marcas); el sitio funciona sin JavaScript |
| `img/` | Logo restaurado en SVG (`logo-color.svg`, el mismo del manual de marca), favicons, `escenas/` (fotos del inicio), `productos/` (fotos que usa la tienda), `ondas.svg` y `og-image.jpg` |
| `favicon.ico`, `site.webmanifest` | Iconos del navegador y de "agregar a pantalla de inicio" |
| `robots.txt`, `sitemap.xml` | Para Google |
| `_headers` | Cabeceras de seguridad y caché que aplica Cloudflare Pages |
| `404.html` | Página de error con la cabecera, «Volver al inicio» y pedido por WhatsApp (rutas desde la raíz) |
| `pruebas/` | Pruebas automáticas y herramientas de revisión (no hacen parte de la página) |
| `.github/workflows/` | Revisión automática en GitHub |

## Secciones de la página

0. **Franja** noche con el domicilio gratis y **cabecera** blanca (logo,
   dirección, teléfono, «Pida ahora») con la banda del menú debajo. Entre las
   dos va la cinta roja y azul de la marca, la misma que abre el pie; sale en
   todas las páginas y se queda arriba cuando la cabecera queda fija.
1. **Portada** en escena: el título va en el aire de la izquierda de la foto
   (computador), encima de la pared (celular) o arriba de la foto (tableta).
   Dice qué vendemos y para quién, nunca el precio (ver «Cómo hablamos» en
   `PRODUCT.md`). Es largo: su letra se achica con la pantalla para que no
   tape los productos de la foto ni saque el botón (lo vigila una prueba). El
   punto de la etiqueta es verde y late como un «en línea»; con «menos
   movimiento» queda quieto.
2. **Marcas** que distribuimos: cinta que avanza sola, con botón de pausa; con
   «menos movimiento» queda quieta. Solo marcas que de verdad se venden, cada
   una con su logo y sus colores (`img/marcas/`): el de su página oficial o el
   archivo que mandó el negocio, nunca uno sacado de otro lado ni dibujado. El
   logo que trae fondo de color lleva la casilla de ese color (`.marca--sol`,
   `.marca--wau`); `es-alta` y `es-baja` emparejan el tamaño de los que son
   muy cuadrados o muy alargados. Sumar o quitar una marca es cambiar las
   cuatro listas iguales de `index.html` y la lista `MARCAS` de
   `pruebas/e2e/inicio.spec.js`.
3. **Categorías** (`#catalogo`) — carrusel de 10 tarjetas que llevan al
   catálogo. Sin JS es una fila deslizable.
4. **Sectores** — mosaico parejo (alta | dos | dos | alta); cada negocio lleva
   a los productos que más se lleva en el catálogo.

**Solo tres botones de WhatsApp en el inicio** (Johan, 10-nov-2026: «le estamos
vendiendo demasiado»): «Pida ahora» de la cabecera, el de la portada y el de
contacto. Sin burbuja flotante ni WhatsApp en el pie, sectores o banners. En el
catálogo, las tarjetas no llevan botón: el único «Pedir por WhatsApp» está en la
ficha de cada producto.
5. **Banners**: mayorista (oscuro) y línea ecológica (`#ecologicos`, claro).
6. **Confianza**: cuatro tarjetas, cada una con el filo de arriba del color
   de su ícono.
7. **Nosotros** con tres cifras y enlace para dejar reseña en Google.
8. **Preguntas** — `details` nativos + datos `FAQPage` (el texto visible debe
   seguir siendo espejo exacto del JSON-LD) y los términos del domicilio.
9. **Contacto**: cómo se pide en tres pasos numerados (buscar en el
   catálogo, escribir por WhatsApp, recibir), el botón de WhatsApp, dirección,
   horario, teléfono y enlace al mapa. Los pasos no llevan botones.

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

## Catálogo público (`/productos/`) y políticas

- **Sin precios** (decisión de Johan, 9-nov-2026): el precio publicado obliga
  (art. 26, Ley 1480), así que cada producto se pide por WhatsApp con su
  nombre y código, y el precio se confirma antes de despachar. Los precios solo
  los ve quien entró a la tienda con su cuenta.
- `/productos/`: categorías en pestañas, buscador en la cabecera (el mismo de
  la tienda, `js/buscar.js`; ahí se ve también en la ficha de un producto, se
  sigue buscando sin devolverse y «atrás» vuelve a la ficha), filtros plegables de marca, medida, color, contenido y «solo
  lo que hay» (salen de las características del CRM, solo cuando hay de dónde
  escoger; en celular y tableta van detrás del botón «Filtros»), orden y la
  ficha de cada producto (`?p=ID`): fotos, pestañas de descripción,
  características y domicilio, y parecidos. El inicio muestra los productos por
  categoría en pestañas («Productos de la bodega»), en una rejilla quieta (nada
  que deslizar de lado: 8 en computador, 6 en celular) y
  las tarjetas de categoría llevan a `/productos/?categoria=…` (si el CRM llama
  distinto la categoría, se busca por el nombre). Todo lo pinta `js/catalogo.js`.
- **Familias de categorías**: el CRM a veces parte una en varias («Aluminio» y
  «Papel Aluminio», «Vasos» y «Vasos Gold», «Bolsas Manija»…). La que tiene
  todas sus palabras dentro de otra se la lleva, así la pestaña muestra todos
  sus productos; un enlace viejo a una parte abre la familia. La que junta varias
  cosas con «y» («Vasos y platos») queda sola.
- Datos: `functions/api/catalogo.js` le pide al CRM el mismo catálogo de la
  tienda (con `PORTAL_CLAVE`) y deja pasar solo nombre, categoría, si hay o no,
  «más pedido», fotos, contenido, descripción y detalles: nunca precio, stock
  ni costo. Guarda la última lista buena en la caché de Cloudflare 14 días, así
  que con el Mac apagado la página sigue mostrando productos. Si no hay ni
  copia, la página lo dice y ofrece WhatsApp; el inicio simplemente no muestra
  las pestañas. `functions/api/foto/[archivo].js` sirve las fotos del CRM (solo
  PNG, JPG, GIF o WebP) con caché de un mes.
- Solo salen los productos marcados «en tienda» en el CRM (activos y con
  precio). Un producto sin foto propia lleva la foto de referencia de su tipo
  (`img/productos/`, Pexels) con el sello «Foto de referencia»; nunca una
  escena hecha con IA prestada de otro producto.
- **La foto en uso va de primera** (Johan, 10-nov-2026: la página «tiene que
  ser muy visual» y «que incite a comprar»). El CRM manda las fotos de cada
  producto en orden: la principal (el producto con su medida, sobre el color de
  su categoría), la segunda (el producto en uso: una escena hecha con IA a
  partir del producto) y las demás. La tarjeta (inicio, catálogo y parecidos) y
  la ficha abren con la segunda; la principal queda de segunda miniatura. Con
  una sola foto se muestra esa. Las fotos del CRM llenan el recuadro, sin marco
  blanco: son cuadradas y traen su propio fondo. Los códigos de
  `SIN_FOTO_EN_USO` (`js/catalogo.js`) tienen de segunda otra cara del paquete,
  no una escena, y siguen con la principal de primera: se saca el código de esa
  lista cuando el producto tenga su foto en uso en el CRM. La página no achica
  las fotos: salen con el peso con que se subieron al CRM.
- Interruptor `PRECIOS_PUBLICOS` (variable de Cloudflare Pages): solo con el
  valor exacto `1` dejaría pasar el precio. Apagado por decisión de Johan; la
  página tampoco lo pintaría sin cambiar `js/catalogo.js`.
- `/terminos/` y `/privacidad/`: las políticas públicas (las de la tienda viven
  en su subdominio y lo público no enlaza a `/tienda`). El pie de todas
  las páginas públicas trae enlaces rápidos, políticas y contacto.

## Tienda en línea (`tienda.plasticosespinal.com`, en pruebas: nadie entra sin cuenta)

- Vive en la carpeta `tienda/` y se abre en **tienda.plasticosespinal.com**
  (decisión de Johan, 10-nov-2026). Es el mismo proyecto de Cloudflare Pages:
  `functions/_middleware.js` reconoce el subdominio y sirve `/` desde `tienda/`,
  `/terminos/` desde `tienda/terminos/` y así. Lo que la tienda pide por su ruta
  completa (`/tienda/tienda.css`, `/tienda/mi-cuenta/api/…`) pasa tal cual, y
  una página pedida con `/tienda/` delante se manda a su dirección limpia.
  `plasticosespinal.com/tienda/…` (con o sin www) redirige con 301 al subdominio.
- Los enlaces entre páginas de la tienda van **relativos** (`terminos/`,
  `../mi-cuenta/`) y los scripts calculan su raíz (`RAIZ`: `/` en el subdominio,
  `/tienda/` en las pruebas y vistas previas). Un enlace a la página principal
  va completo (`https://www.plasticosespinal.com/`): en el subdominio, `/` es la tienda.
- **`_routes.json`** dice qué rutas despiertan las funciones; lo demás (fotos,
  letras, estilos) se sirve solo y no gasta peticiones del plan gratis. Una
  página nueva de la tienda (`tienda/<algo>/`) necesita ahí `/<algo>` y `/<algo>/*`
  (una prueba lo exige).
- Para que el subdominio funcione hace falta, una sola vez, agregarlo en
  Cloudflare: Workers & Pages → plasticos-espinal-web → Custom domains →
  «Set up a custom domain» → `tienda.plasticosespinal.com` (Cloudflare crea el
  registro DNS solo). Primero el dominio y después publicar este cambio: si se
  publica antes, `/tienda` de la página redirige a un subdominio que aún no existe.
- **Vista previa** (`*.pages.dev`): `<vista previa>/?sitio=tienda` la muestra
  como el subdominio; `?sitio=web` vuelve a la página. En las pruebas en
  navegador, `tienda.localhost:4173` imita el subdominio (`pruebas/servidor.mjs`).
- **Nadie entra sin cuenta** (decisión de Johan, 10-nov-2026; antes había una
  contraseña de prueba). Sin la galleta de la sesión (`pe_sesion`), el middleware
  manda toda página de la tienda a la entrada (`/mi-cuenta/`, con `?volver=` para
  regresar a lo que se pidió); sin cuenta solo se ven la entrada, los términos y
  la política de datos. El middleware solo mira que la galleta exista: si la
  sesión vale lo dice el CRM (catálogo con `sesion: false` y sin precios, 401 en
  lo demás), y ahí la tienda misma manda a la entrada. Mientras está en pruebas
  **no tiene enlaces desde el sitio** y todo va `noindex`.
- **La entrada** (`tienda/mi-cuenta/index.html`, `entrada.css`, `cuenta.js`): una
  sola página con sus pantallas (bienvenida, crear cuenta en tres pasos, entrar y
  olvidé mi contraseña). El cliente crea su cuenta (nombre, cédula, celular),
  confirma su WhatsApp escribiendo el código que le manda la tienda (o, si el CRM
  está en «cliente_escribe», mandándonos el que le muestra la página) y pone su
  contraseña; después entra con cédula o celular + contraseña, y «Olvidé mi
  contraseña» repite la confirmación por WhatsApp. Al entrar vuelve a lo que
  estaba viendo (solo direcciones de la misma tienda). En un celular donde ya
  entró alguien, abre directo en «Entrar».
- **Mi cuenta**: en la cabecera despliega un panel pequeño (Mis pedidos, Mis
  datos, Salir). Ve sus compras de tienda y mostrador, descarga el recibo PDF y
  edita nombre, barrio, dirección e indicaciones (celular y documento NO: son la
  llave).
- **El pedido** no pide la cédula (el CRM pone la de la cuenta) y propone los
  datos de entrega: lo último que esa cuenta escribió en ese celular y, si no, lo
  guardado en «Mis datos». La canasta suma con el **precio por cantidad** que
  manda el CRM en `escalones` (`precioDe` en `tienda.js`); la ficha lo anuncia.
  Los datos vienen del CRM a través de `functions/tienda/mi-cuenta/api/[[ruta]].js`,
  el único de la tienda que habla con el CRM (lo público solo lee el catálogo y
  las fotos, ver «Catálogo público»): le pone la clave `PORTAL_CLAVE` (secreto de
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
