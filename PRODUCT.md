# Product

## Register

brand

## Users

Dueños y encargados de negocios del Tolima (El Espinal y alrededores): restaurantes,
asaderos, panaderías, reposterías, comidas rápidas, heladerías, tiendas y minimercados,
además de familias que arman eventos. Llegan buscando surtir desechables al por mayor o
al detal con precio de distribuidora y despacho el mismo día. Contexto de uso: mayormente
celular, decisión rápida, quieren cotizar y pedir sin fricción.

## Product Purpose

Sitio público de una sola página que presenta a Plásticos Espinal como distribuidora de
desechables y plásticos (marcas Darnel, Carvajal Empaques, Ajover y su línea
biodegradable). El éxito es una conversión: el visitante entiende el catálogo y escribe
por WhatsApp con un pedido o cotización. No es tienda transaccional; es vitrina + puente a
WhatsApp.

## Brand Personality

Festiva y sanpedrina (sombrero y tambor del San Pedro, tierra del tamal), pero con la
confianza de un catálogo corporativo serio. Tres palabras: local, alegre, confiable. Debe
sentirse cercana y de la región sin perder credibilidad de proveedor mayorista.

## Anti-references

- Plantilla SaaS genérica (hero-métricas, eyebrow-píldora en cada sección, tarjetas
  idénticas en rejilla, glassmorphism decorativo).
- Estética editorial-magazine (serif display + itálicas + drop caps): no es una revista.
- Cualquier look que borre el carácter San Pedro y la vuelva "un desechables más".

## Design Principles

1. WhatsApp-first: cada sección empuja a un `wa.me` con mensaje pre-llenado y contexto.
2. Mostrar, no solo decir: la festividad San Pedro se ve (paleta del logo, franja
   roja/amarilla), no solo se menciona en el texto.
3. Identidad del logo como sistema: azul profundo, azul vivo, rojo y amarillo son los
   únicos colores de marca; se usan con disciplina.
4. Confianza mayorista: cifras y afirmaciones verificables, nada de relleno inflado.
5. Móvil y accesibilidad primero: áreas táctiles ≥44px, contraste AA, `prefers-reduced-motion`.

## Estado (julio 2026)

Diseño 2 "cartel de plaza" (el diseño 1 corporativo-blanco fue descartado y
eliminado por decisión del dueño): lienzo azul noche
(#0e1a47), tipografía de afiche Archivo Black + Archivo (self-hosted), sombras
duras de imprenta, stickers rotados, cintas tricolor, boletos troquelados,
papel picado en la sección eco, notas con cinta adhesiva en reseñas.
Secciones: portada, marquesina de contorno, catálogo (tarjetas → WhatsApp),
sectores, eco, nosotros, reseñas (⚠️ testimonios de muestra, reemplazar por
reales), FAQ (JSON-LD FAQPage), contacto.
Seguridad: CSP con hash del script inline, `_headers` + `.htaccess` + `security.txt`.
Fotos: Pexels (ver `img/productos/CREDITS.txt`).

## Accessibility & Inclusion

Meta WCAG 2.1 AA. Ya implementado: skip-link, `:focus-visible`, `prefers-reduced-motion`,
hover gated por `(hover:hover)`, `srcset/sizes`, JSON-LD LocalBusiness, hoja de impresión,
y áreas táctiles ≥44px en móvil. Mantener contraste de texto ≥4.5:1 (cuerpo) y no
codificar significado solo por color.
