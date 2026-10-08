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
2. Si tocaste un CSS o JS, sube su `?v=N` en todas las páginas que lo piden
   (`css/estilos.css` en `index.html` y `404.html`; `js/principal.js` en
   `index.html`; `tienda/tienda.css` y `tienda/tienda.js` en
   `tienda/index.html`). `_headers` los guarda 7 días en caché; sin subir el
   número, los visitantes siguen viendo la versión vieja. La revisión
   automática lo exige.
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
npm run mutaciones     # rompe a propósito 30 partes críticas en una copia y
                       # comprueba que alguna prueba lo atrapa
```

| Qué | Dónde |
|---|---|
| Enlaces, CSP, caché, regresiones de contenido | `pruebas/unit/sitio.test.mjs` |
| Contrato del catálogo que exportará el CRM | `pruebas/unit/catalogo.test.mjs` |
| Candado de la tienda (contraseña, galleta, noindex) | `pruebas/unit/candado.test.mjs` |
| Canasta, domicilio, mensaje de WhatsApp, búsqueda | `pruebas/e2e/tienda.spec.js` |
| Inicio y 404 en Chromium, con las cabeceras reales de `_headers` | `pruebas/e2e/inicio.spec.js` |

GitHub Actions (`.github/workflows/revision.yml`) corre todo en cada PR y en
cada push a `main`.

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
  despliega un panel pequeño (Mis pedidos, Mis datos, Salir). El cliente entra
  con cédula/NIT + celular y un código de 6 números que le llega al correo; ve
  sus compras de tienda y mostrador, descarga el recibo PDF y edita nombre,
  barrio, dirección e indicaciones (celular y correo NO: son la llave).
  Los datos vienen del CRM a través de `functions/tienda/mi-cuenta/api/[[ruta]].js`,
  el ÚNICO que habla con el CRM: le pone la clave `PORTAL_CLAVE` (secreto de
  Cloudflare Pages, el mismo valor del `.env` del CRM) y guarda la sesión del
  cliente en una galleta HttpOnly. Sin ese secreto el portal dice que no pudo
  traer los datos. El navegador nunca ve la dirección del CRM.
- Diseño «tienda primero»: búsqueda y canasta arriba, categorías en fotos,
  combo, lo más pedido y compra por tipo de negocio; Plásticos Espinal queda en
  el logo y el pie.
- Lee `tienda/catalogo.json`. Hoy trae **productos de muestra**; en la fase 2 lo
  publica el CRM cada noche con las 80 referencias marcadas «Se vende en línea».
- Forma del archivo: `domicilio` (`tarifa`, `gratis_desde`), `whatsapp`,
  `categorias` (`id`, `nombre`, `imagen`) y `productos` (`id`, `nombre`,
  `categoria`, `precio` con IVA, `destacado` e `imagen` opcionales).
- La canasta se guarda en el navegador y se envía a WhatsApp con un código
  `PE-XXXX` y el `[#id]` de cada producto. El bot recalcula los precios con el
  CRM: el total del mensaje es solo de referencia.
