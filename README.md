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

1. Edita los archivos.
2. Si tocaste `css/estilos.css` o `js/principal.js`, sube su `?v=N`
   (hoy `?v=10`): el CSS en `index.html` y `404.html`, el JS en
   `index.html`. `_headers` los guarda 7 días en caché; sin subir el número,
   los visitantes siguen viendo la versión vieja.
3. `git add` + `git commit` + `git push origin main` — Cloudflare Pages
   despliega solo en ~1 minuto.

## ✏️ Datos pendientes de mejorar

1. **Reseñas reales** — la sección «Por qué nos eligen» (`#resenas`) no
   muestra testimonios: solo invita a dejar reseña en Google. Cuando haya
   reseñas reales (con permiso) o ficha de Google Business Profile, pueden
   sumarse ahí.
2. **`og-image.jpg`** — la imagen para compartir en redes sigue siendo la de
   un diseño anterior; conviene rehacerla con la cápsula actual.
3. **Presentaciones de venta** — cuando se definan ("paca x100", "desde 1
   caja"), añadirlas a las tarjetas del catálogo; también un bloque "Los más
   pedidos" con productos concretos.

## Estructura de archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página completa (portada, marcas, catálogo, sectores, línea ecológica, nosotros, por qué nos eligen, preguntas, contacto) |
| `css/estilos.css` | Todos los estilos (sistema «hermana del CRM, más sobria»; colores del `:root` del CRM) |
| `js/principal.js` | JS mínimo con `defer` (año del pie, sombra de la cabecera, menú activo, burbuja de WhatsApp); el sitio funciona sin JavaScript |
| `img/` | Logo optimizado (2 tamaños), favicons, fotos de producto, `ondas.svg` (relleno de la cápsula) y `og-image.jpg` |
| `favicon.ico`, `site.webmanifest` | Iconos del navegador y de "agregar a pantalla de inicio" |
| `robots.txt`, `sitemap.xml` | Para Google |
| `_headers` | Cabeceras de seguridad y caché que aplica Cloudflare Pages |
| `404.html` | Página de error con la cápsula, «Volver al inicio» y pedido por WhatsApp (rutas desde la raíz) |

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
  comentario del archivo). Al abrirla al público se borra `functions/tienda/`.
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
