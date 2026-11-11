/* La entrada de la tienda y el portal del cliente (/tienda/mi-cuenta/) en Chromium, con el
   intermediario simulado. Nadie entra sin cuenta: sin sesión, la tienda manda a la entrada
   (bienvenida, crear cuenta, entrar) y al entrar se vuelve a lo que se estaba viendo.
   Mis pedidos, una compra y Mis datos se ven SIEMPRE en una ventana encima de la tienda
   (menu.js): por eso esas pruebas abren /tienda/#cuenta=… y miran dentro del marco.
   La puerta de verdad (functions/_middleware.js) y el intermediario tienen sus pruebas en
   unit/candado.test.mjs y unit/mi-cuenta.test.mjs: el servidor local no los corre. */
import { test, expect } from '@playwright/test';
import { vigilar, sitioDe, sinSesion, CATALOGO_CRM } from './ayudas.js';

const YO = { ok: true, nombre: 'Ana <b>Pérez</b>', estado: 'activa', tipo_documento: 'CC', documento: '1105678901', celular: '318 355 5246', correo: 'ana@ejemplo.com', municipio: 'El Espinal', barrio: 'El Centro', direccion: 'Calle 7 # 5-35', indicaciones: '' };
const PEDIDOS = { ok: true, pedidos: [
  { id: 12, numero: 'FE-0012', fecha: '2026-10-01 10:00', canal: 'Domicilio', total: 61000, por_pagar: false, entrega: 'Entregado' },
] };
const PEDIDO = { ok: true, id: 12, numero: 'FE-0012', fecha: '2026-10-01 10:00', canal: 'Domicilio', forma_pago: 'Bre-B', total: 61000, descuento: 0, lineas: [{ producto: 'Vaso grande', cantidad: 2, valor: 57000 }], tiene_recibo: true };
const CLAVE_BUENA = 'una-clave-larga';
const SIN_SESION = sinSesion();

/**
 * Simula el intermediario: con sesión responde datos y el catálogo con precios; sin sesión, 401 y
 * el catálogo sin precios. Entrar pide la contraseña buena; crear cuenta y «olvidé» pasan por el
 * código del WhatsApp (123456) antes de poner la contraseña.
 * @param {import('@playwright/test').Page} page
 * @param {{ sesion?: boolean, estado?: string, modo?: string, yo?: any }} [o]
 *   estado: cómo queda la cuenta al poner la contraseña (por omisión 'activa');
 *   modo: cómo se prueba el celular (por omisión 'enviar_codigo'; 'cliente_escribe' = él nos manda el código).
 */
async function api(page, o = {}) {
  /** @type {string[]} */
  const llamadas = [];
  /** @type {any[]} */
  const cuerpos = [];
  let sesion = !!o.sesion;
  const escribe = o.modo === 'cliente_escribe';
  const codigo = escribe
    ? { ok: true, modo: 'cliente_escribe', codigo: '123456', whatsapp: '573183555246', mensaje: 'Mi código de la tienda es 123456', minutos: 10 }
    : { ok: true, modo: 'enviar_codigo', minutos: 10 };
  await sitioDe(page);
  await page.route('**/tienda/mi-cuenta/api/**', async (r) => {
    const ruta = new URL(r.request().url()).pathname.replace('/tienda/mi-cuenta/api/', '');
    const cuerpo = JSON.parse(r.request().postData() || '{}');
    llamadas.push(`${r.request().method()} ${ruta}`);
    cuerpos.push({ ruta, cuerpo });
    if (ruta === 'tienda/catalogo') return r.fulfill({ json: sesion ? CATALOGO_CRM : SIN_SESION });
    if (ruta.startsWith('tienda/foto/')) return r.fulfill({ status: 404 });
    if (ruta === 'entrar') {
      if (cuerpo.clave !== CLAVE_BUENA) return r.fulfill({ status: 401, json: { ok: false, error: 'Cédula, celular o contraseña equivocados.' } });
      sesion = true;
      return r.fulfill({ json: { ok: true, nombre: 'Ana', estado: 'activa' } });
    }
    if (ruta === 'salir') { sesion = false; return r.fulfill({ json: { ok: true } }); }
    if (ruta === 'registro' || ruta === 'olvide') return r.fulfill({ json: codigo });
    if (ruta === 'verificar') {
      if (escribe) return r.fulfill({ json: { ok: true, listo: true } });
      if (cuerpo.codigo !== '123456') return r.fulfill({ status: 400, json: { ok: false, error: 'Código equivocado.' } });
      return r.fulfill({ json: { ok: true, listo: true } });
    }
    if (ruta === 'clave') { sesion = true; return r.fulfill({ json: { ok: true, nombre: 'Ana Pérez', estado: o.estado || 'activa' } }); }
    if (!sesion) return r.fulfill({ status: 401, json: { ok: false, error: 'Entre otra vez.' } });
    if (ruta === 'yo' || ruta === 'datos') return r.fulfill({ json: o.yo || YO });
    if (ruta === 'pedidos') return r.fulfill({ json: PEDIDOS });
    if (ruta === 'pedidos/12') return r.fulfill({ json: PEDIDO });
    return r.fulfill({ status: 404, json: { ok: false, error: 'No existe.' } });
  });
  return Object.assign(llamadas, { cuerpos });
}

/** @param {import('@playwright/test').Page} page */
const marco = (page) => page.frameLocator('iframe.vc-marco');

/**
 * Las páginas que abrió la pestaña misma (no el marco de la ventana), en orden.
 * @param {import('@playwright/test').Page} page
 */
function paginasDeLaPestana(page) {
  /** @type {string[]} */
  const rutas = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) rutas.push(new URL(f.url()).pathname); });
  return rutas;
}

/** @param {import('@playwright/test').Page} page @param {string} ruta lo que va después de /tienda/mi-cuenta/ */
const abrirEnVentana = (page, ruta) => page.goto('/tienda/#cuenta=' + encodeURIComponent('/tienda/mi-cuenta/' + ruta));

/** Entra con la cédula y la contraseña buena (la pantalla «Entrar» ya tiene que estar a la vista). @param {import('@playwright/test').Page} page */
async function entrar(page) {
  await page.fill('#usuario', '1105678901');
  await page.fill('#clave', CLAVE_BUENA);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** La tienda quedó abierta y con productos. @param {import('@playwright/test').Page} page */
const enLaTienda = (page) => expect(page.locator('#grilla li').first()).toBeVisible();

/** Sin desborde lateral: nada se sale de la pantalla. @param {import('@playwright/test').Page} page */
async function sinDesborde(page) {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(ancho, 'la página se desborda de lado').toBeLessThanOrEqual(0);
}

/* ---------------- la entrada ---------------- */

test('la primera vez se ve la bienvenida con sus dos puertas, sin la cabecera de la tienda ni un solo precio', async ({ page }) => {
  const v = vigilar(page);
  const llamadas = await api(page);
  await page.goto('/tienda/mi-cuenta/');
  await expect(page.locator('#v-bienvenida')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Empaques plásticos, desechables y biodegradables');
  await expect(page.locator('header, .cab, #grilla')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('$');
  await sinDesborde(page);
  await page.getByRole('link', { name: 'Crear mi cuenta' }).click();
  await expect(page.locator('#v-crear')).toBeVisible();
  await expect(page.locator('#v-bienvenida')).toBeHidden();
  await expect(page.locator('#nombre')).toBeFocused();
  await sinDesborde(page);
  await page.getByRole('link', { name: 'Ya tengo cuenta' }).click();
  await expect(page.locator('#v-entrar')).toBeVisible();
  await expect(page.locator('#usuario')).toBeFocused();
  await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
  await expect(page.locator('#v-olvide')).toBeVisible();
  /* «atrás» del celular devuelve a la pantalla anterior */
  await page.goBack();
  await expect(page.locator('#v-entrar')).toBeVisible();
  expect(llamadas, 'la entrada no pide el catálogo').not.toContain('GET tienda/catalogo');
  v.sinProblemas();
});

test('los términos y la política de datos se leen desde la entrada, sin cuenta', async ({ page }) => {
  await api(page);
  await page.goto('/tienda/mi-cuenta/');
  const pie = page.locator('footer');
  await expect(pie.getByRole('link', { name: 'Términos, cambios y retracto' })).toHaveJSProperty('href', new URL('/tienda/terminos/', page.url()).href);
  await expect(pie.getByRole('link', { name: 'Política de datos' })).toHaveJSProperty('href', new URL('/tienda/privacidad/', page.url()).href);
  /* Y crear la cuenta dice qué se acepta, con los dos enlaces en otra pestaña (lo escrito no se pierde) */
  await page.goto('/tienda/mi-cuenta/#crear');
  const legal = page.locator('#v-crear .legal');
  await expect(legal).toContainText('Al crear su cuenta acepta los términos de la tienda y autoriza el uso de sus datos');
  for (const nombre of ['términos de la tienda', 'política de datos']) {
    await expect(legal.getByRole('link', { name: nombre })).toHaveAttribute('target', '_blank');
  }
});

test('entrar con cédula y contraseña lleva a la tienda, y ese celular abre la próxima vez en «Entrar»', async ({ page }) => {
  const v = vigilar(page);
  const llamadas = await api(page);
  const pestana = paginasDeLaPestana(page);
  await page.goto('/tienda/mi-cuenta/#entrar');
  await page.fill('#usuario', '1105678901');
  await page.fill('#clave', 'otra-clave');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#e-entrar')).toHaveText('Cédula, celular o contraseña equivocados.');
  await expect(page).toHaveURL(/\/tienda\/mi-cuenta\/#entrar$/);
  await entrar(page);
  await expect(page).toHaveURL(/\/tienda\/$/);
  await enLaTienda(page);
  expect(llamadas.filter((l) => l === 'POST entrar')).toHaveLength(2);
  expect(pestana, 'va directo a la tienda, sin pasar por Mis pedidos').not.toContain('/tienda/mi-cuenta/pedidos/');
  v.sinProblemas();
  /* Sale de su cuenta: queda en la entrada, lista para entrar otra vez */
  await page.locator('.cab .btn-cuenta').click();
  await page.getByRole('button', { name: 'Salir de mi cuenta' }).click();
  await expect(page).toHaveURL(/\/tienda\/mi-cuenta\/#entrar$/);
  await expect(page.locator('#v-entrar')).toBeVisible();
  expect(llamadas).toContain('POST salir');
  /* Y sin el #entrar, ese celular ya no muestra la bienvenida: abre en «Entrar» */
  await page.goto('/tienda/mi-cuenta/');
  await expect(page.locator('#v-entrar')).toBeVisible();
  await expect(page.locator('#v-bienvenida')).toBeHidden();
});

test('quien ya entró y abre la entrada va directo a la tienda', async ({ page }) => {
  await api(page, { sesion: true });
  await page.goto('/tienda/mi-cuenta/');
  await expect(page).toHaveURL(/\/tienda\/$/);
  await enLaTienda(page);
});

test('el formulario de entrada valida antes de llamar', async ({ page }) => {
  const llamadas = await api(page);
  await page.goto('/tienda/mi-cuenta/#entrar');
  await page.fill('#usuario', '12');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#e-entrar')).toHaveText('Escriba su cédula o su celular.');
  await page.fill('#usuario', '1105678901');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#e-entrar')).toHaveText('Escriba su contraseña.');
  expect(llamadas).not.toContain('POST entrar');
});

/* ---------------- sin sesión no hay tienda, y al entrar se vuelve a lo que se pidió ---------------- */

test('sin sesión, la tienda manda a la entrada y al entrar vuelve al mismo producto', async ({ page }) => {
  await api(page);
  await page.goto('/tienda/?desde=whatsapp#p=141');
  await expect(page).toHaveURL(/\/tienda\/mi-cuenta\/\?volver=%2Ftienda%2F%3Fdesde%3Dwhatsapp#p=141$/);
  await expect(page.locator('#v-bienvenida')).toBeVisible();
  await page.getByRole('link', { name: 'Ya tengo cuenta' }).click();
  await entrar(page);
  await expect(page).toHaveURL(/\/tienda\/\?desde=whatsapp/);
  await expect(page.locator('#ficha')).toBeVisible();
  await expect(page.locator('#ficha')).toContainText('Contenedor icopor J1 x25 und');
});

test('sin sesión, el inicio de la tienda manda a la entrada sin nada que recordar', async ({ page }) => {
  await api(page);
  await page.goto('/tienda/');
  await expect(page).toHaveURL(/\/tienda\/mi-cuenta\/$/);
  await expect(page.locator('#v-bienvenida')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('$');
});

for (const ruta of ['pedidos/', 'pedido/?id=12', 'datos/']) {
  test(`sin sesión, /tienda/mi-cuenta/${ruta} lleva a la entrada (la página entera, no la ventana)`, async ({ page }) => {
    await api(page);
    await page.goto('/tienda/mi-cuenta/' + ruta);
    await expect(page).toHaveURL(/\/tienda\/mi-cuenta\/#cuenta=/);
    await expect(page.locator('#v-bienvenida')).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
  });
}

test('un enlace guardado a Mis pedidos, sin sesión, pide entrar y después abre Mis pedidos sobre la tienda', async ({ page }) => {
  await api(page);
  await page.goto('/tienda/mi-cuenta/pedidos/');
  await expect(page.locator('#v-bienvenida')).toBeVisible();
  await page.getByRole('link', { name: 'Ya tengo cuenta' }).click();
  await entrar(page);
  await expect(page).toHaveURL(/\/tienda\/#cuenta=%2Ftienda%2Fmi-cuenta%2Fpedidos%2F$/);
  await expect(marco(page).locator('#lista')).toContainText('FE-0012');
});

for (const [caso, volver] of [
  ['otro sitio', 'https://malo.example/tienda/'],
  ['otro sitio sin protocolo', '//malo.example/tienda/'],
  ['una ruta que termina en otro sitio', '/tienda/..//malo.example/'],
  ['la página principal', '/terminos/'],
  ['la misma entrada', '/tienda/mi-cuenta/'],
]) {
  test(`una dirección de vuelta a ${caso} no se obedece: al entrar va al inicio de la tienda`, async ({ page }) => {
    /** @type {string[]} */
    const fuera = [];
    page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1') fuera.push(u.href); });
    await api(page);
    await page.goto('/tienda/mi-cuenta/?volver=' + encodeURIComponent(volver) + '#entrar');
    await entrar(page);
    await enLaTienda(page);
    expect(new URL(page.url()).pathname).toBe('/tienda/');
    expect(fuera).toEqual([]);
  });
}

/* ---------------- crear cuenta ---------------- */

/** Llena «Crear cuenta» y pide el código. @param {import('@playwright/test').Page} page */
async function pedirCodigo(page) {
  await page.goto('/tienda/mi-cuenta/#crear');
  await page.fill('#nombre', '  Ana   Pérez ');
  await page.fill('#documento', '1.105.678.901');
  await page.fill('#celular', '318 355 5246');
  await page.fill('#correo', '  Ana@Correo.CO ');
  await page.getByRole('button', { name: 'Enviarme el código' }).click();
}

test('crear cuenta: nombre, cédula y celular, el código del WhatsApp, la contraseña y a la tienda', async ({ page }) => {
  const v = vigilar(page);
  const llamadas = await api(page);
  const pestana = paginasDeLaPestana(page);
  await pedirCodigo(page);
  expect(llamadas.cuerpos.find((c) => c.ruta === 'registro').cuerpo).toEqual({ nombre: 'Ana Pérez', documento: '1105678901', celular: '3183555246', correo: 'ana@correo.co' });
  await expect(page.locator('#f-codigo')).toBeVisible();
  await expect(page.locator('#s-verificar')).toHaveText('Lo mandamos al WhatsApp 318 *** 5246. Vence en 10 minutos.');
  await expect(page.locator('#codigo')).toBeFocused();
  await sinDesborde(page);
  /* El código equivocado: con el sexto número se confirma solo, y lo dice */
  await page.locator('#codigo').pressSequentially('000000');
  await expect(page.locator('#e-verificar')).toHaveText('Código equivocado.');
  await expect(page.locator('#casillas span').nth(5)).toHaveText('0');
  /* El bueno, pegado de una vez (letras y espacios no cuentan) */
  await page.fill('#codigo', '');
  await page.fill('#codigo', '123 456');
  await expect(page.locator('#v-clave')).toBeVisible();
  expect(llamadas.cuerpos.filter((c) => c.ruta === 'verificar').map((c) => c.cuerpo)).toEqual([{ codigo: '000000' }, { codigo: '123456' }]);
  /* La contraseña: una sola casilla, con «Ver» y lo fuerte que va */
  await expect(page.locator('#nueva')).toBeFocused();
  await page.fill('#nueva', 'corta');
  await expect(page.locator('#fuerza')).toHaveClass('fuerza n1');
  await page.getByRole('button', { name: 'Entrar a la tienda' }).click();
  await expect(page.locator('#e-clave')).toHaveText('La contraseña debe tener al menos 8 letras o números.');
  expect(llamadas).not.toContain('POST clave');
  await page.fill('#nueva', CLAVE_BUENA);
  await expect(page.locator('#nueva')).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  await expect(page.locator('#nueva')).toHaveAttribute('type', 'text');
  await expect(page.locator('#ver-clave')).toHaveText('Ocultar');
  await expect(page.locator('#ver-clave')).toHaveAttribute('aria-pressed', 'true');
  await sinDesborde(page);
  await page.getByRole('button', { name: 'Entrar a la tienda' }).click();
  await expect(page.locator('#t-listo')).toHaveText('¡Hola, Ana!');
  await expect(page.locator('#s-listo')).toHaveText('Su cuenta quedó lista.');
  expect(llamadas.cuerpos.find((c) => c.ruta === 'clave').cuerpo).toEqual({ clave: CLAVE_BUENA });
  /* Y sola, a la tienda */
  await expect(page).toHaveURL(/\/tienda\/$/);
  await enLaTienda(page);
  expect(pestana).not.toContain('/tienda/mi-cuenta/pedidos/');
  v.sinProblemas();
});

test('crear cuenta valida cada dato antes de pedir el código', async ({ page }) => {
  const llamadas = await api(page);
  await page.goto('/tienda/mi-cuenta/#crear');
  const seguir = page.getByRole('button', { name: 'Enviarme el código' });
  await seguir.click();
  await expect(page.locator('#e-crear')).toHaveText('Escriba su nombre completo.');
  await page.fill('#nombre', 'Ana Pérez');
  await seguir.click();
  await expect(page.locator('#e-crear')).toHaveText('Escriba su número de documento.');
  await page.fill('#documento', '1105678901');
  await page.fill('#celular', '6012345678');
  await seguir.click();
  await expect(page.locator('#e-crear')).toHaveText('Escriba su celular de 10 dígitos.');
  await page.fill('#celular', '3183555246');
  /* El correo es obligatorio: ahí le llega el cupón del primer domicilio */
  for (const malo of ['', 'ana', 'ana@correo', 'a b@correo.co']) {
    await page.fill('#correo', malo);
    await seguir.click();
    await expect(page.locator('#e-crear')).toHaveText('Escriba su correo: ahí le llega el cupón de su primer domicilio gratis.');
  }
  expect(llamadas).not.toContain('POST registro');
});

test('«No me llegó» manda el código otra vez con los mismos datos, y «Empezar de nuevo» devuelve al primer paso', async ({ page }) => {
  const llamadas = await api(page);
  await pedirCodigo(page);
  await expect(page.locator('#f-codigo')).toBeVisible();
  await page.locator('#codigo').pressSequentially('12');
  await page.getByRole('button', { name: 'No me llegó, mandarlo otra vez' }).click();
  await expect.poll(() => llamadas.filter((l) => l === 'POST registro').length).toBe(2);
  const [uno, dos] = llamadas.cuerpos.filter((c) => c.ruta === 'registro').map((c) => c.cuerpo);
  expect(dos).toEqual(uno);
  await expect(page.locator('#codigo')).toHaveValue('');     /* el código viejo ya no sirve */
  await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
  await expect(page.locator('#v-crear')).toBeVisible();
  await expect(page.locator('#nombre')).toHaveValue('  Ana   Pérez ');   /* lo escrito sigue ahí */
});

test('una cuenta por confirmar lo explica y espera a que la persona toque el botón', async ({ page }) => {
  await api(page, { estado: 'por_confirmar' });
  await pedirCodigo(page);
  await page.fill('#codigo', '123456');
  await page.fill('#nueva', CLAVE_BUENA);
  await page.getByRole('button', { name: 'Entrar a la tienda' }).click();
  await expect(page.locator('#s-listo')).toContainText('ya puede ver precios y pedir');
  await expect(page.locator('#s-listo')).toContainText('sus compras anteriores salen cuando la tienda confirme que es usted');
  const boton = page.locator('#a-la-tienda');
  await expect(boton).toBeVisible();
  await page.waitForTimeout(2200);                            /* no se va sola: hay algo que leer */
  await expect(page).toHaveURL(/\/tienda\/mi-cuenta\//);
  await boton.click();
  await expect(page).toHaveURL(/\/tienda\/$/);
  await enLaTienda(page);
});

test('si la tienda pide que el cliente mande el código, se lo muestra con el botón de WhatsApp y sigue sola', async ({ page }) => {
  const llamadas = await api(page, { modo: 'cliente_escribe' });
  await pedirCodigo(page);
  await expect(page.locator('#v-clave')).toBeVisible();        /* el CRM ya vio el mensaje: pasa a la contraseña */
  expect(llamadas).toContain('POST verificar');
  await expect(page.locator('#mi-codigo')).toHaveText('123 456');
  await expect(page.locator('#abrir-wa')).toHaveAttribute('href', 'https://wa.me/573183555246?text=' + encodeURIComponent('Mi código de la tienda es 123456'));
});

/* ---------------- olvidé mi contraseña ---------------- */

test('olvidé mi contraseña: el código va al WhatsApp de la cuenta, se pone la nueva y a la tienda', async ({ page }) => {
  const llamadas = await api(page);
  await page.goto('/tienda/mi-cuenta/#entrar');
  await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
  await page.getByRole('button', { name: 'Enviarme el código' }).click();
  await expect(page.locator('#e-olvide')).toHaveText('Escriba su cédula o su celular.');
  await page.fill('#usuario2', '318 355 5246');
  await page.getByRole('button', { name: 'Enviarme el código' }).click();
  await expect(page.locator('#f-codigo')).toBeVisible();
  expect(llamadas.cuerpos.find((c) => c.ruta === 'olvide').cuerpo).toEqual({ usuario: '3183555246' });
  /* No se dice a qué número: quien lo pide puede no ser el dueño de la cuenta */
  await expect(page.locator('#s-verificar')).toHaveText('Lo mandamos al WhatsApp de su cuenta. Vence en 10 minutos.');
  await page.fill('#codigo', '123456');
  await page.fill('#nueva', CLAVE_BUENA);
  await page.getByRole('button', { name: 'Entrar a la tienda' }).click();
  await expect(page.locator('#s-listo')).toHaveText('Su contraseña quedó cambiada.');
  await expect(page).toHaveURL(/\/tienda\/$/);
  await enLaTienda(page);
});

/* ---------------- Mis pedidos, una compra y Mis datos (con sesión) ---------------- */

test('un enlace guardado a Mis pedidos se va a la tienda sin pedir nada desde la página que se va', async ({ page }) => {
  const llamadas = await api(page, { sesion: true });
  await page.goto('/tienda/mi-cuenta/pedidos/');
  await expect(page).toHaveURL(/\/tienda\/#cuenta=%2Ftienda%2Fmi-cuenta%2Fpedidos%2F$/);
  await expect(marco(page).locator('#lista')).toContainText('FE-0012');
  await expect(marco(page).locator('#lista')).toContainText('$61.000');
  expect(llamadas.filter((l) => l === 'GET pedidos'), 'solo los pide la ventana').toHaveLength(1);
});

test('Mis pedidos muestra los pedidos de la tienda que aún no son venta, en cualquier celular', async ({ page }) => {
  const v = vigilar(page);
  await api(page, { sesion: true });
  await page.route('**/tienda/mi-cuenta/api/pedidos', (r) => r.fulfill({ json: { ...PEDIDOS, en_curso: [
    { codigo: 'PE-0017', fecha: '2026-11-11 00:40', estado: 'POR_CONFIRMAR', titulo: 'Pedido por confirmar', total: 23500, productos: 2, abierto: true, medio: 'efectivo' },
    { codigo: 'PE-0009', fecha: '2026-11-08 09:10', estado: 'NO_ENTREGADO', titulo: 'No pudimos tomar el pedido', total: 9000, productos: 1, abierto: false },
  ] } }));
  await abrirEnVentana(page, 'pedidos/');
  const lista = marco(page).locator('#lista');
  await expect(lista).toContainText('Pedido PE-0017');
  await expect(lista).toContainText('Confirmando');
  await expect(lista).toContainText('$23.500');
  await expect(lista).toContainText('No pudimos tomar el pedido');
  await expect(lista).toContainText('FE-0012');                 /* las compras siguen debajo */
  await expect(lista).not.toContainText('Aún no vemos compras');
  /* Se abre con un botón (la tienda lo pide con la sesión), no con un enlace con el secreto */
  await expect(marco(page).getByRole('link', { name: /PE-0017/ })).toHaveCount(0);
  v.sinProblemas();
});

test('un pedido con el pago a medias dice «Terminar el pago» y lo abre en la tienda', async ({ page }) => {
  await api(page, { sesion: true });
  await page.route('**/tienda/mi-cuenta/api/pedidos', (r) => r.fulfill({ json: { ...PEDIDOS, en_curso: [
    { codigo: 'PE-ABCDE', fecha: '2026-11-11 00:40', estado: 'POR_CONFIRMAR', titulo: 'Pedido por confirmar', total: 23500, productos: 2, abierto: true, medio: 'qr', pago_avisado: false },
  ] } }));
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido/PE-ABCDE', (r) => r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE',
    estado: 'POR_CONFIRMAR', titulo: 'Pedido por confirmar', medio: 'qr', pago_avisado: false, total: 23500, puede_cancelar: true, final: false } }));
  await abrirEnVentana(page, 'pedidos/');
  const fila = marco(page).getByRole('button', { name: /PE-ABCDE/ });
  await expect(fila).toContainText('Falta el pago');
  await expect(fila).toContainText('Terminar el pago');
  await fila.click();
  await expect(page.locator('#pago')).toBeVisible();
  await expect(page.locator('#pCodigo')).toHaveText('PE-ABCDE');
});

test('una compra muestra sus líneas, total y el recibo por el intermediario', async ({ page }) => {
  const v = vigilar(page);
  await api(page, { sesion: true });
  await abrirEnVentana(page, 'pedido/?id=12');
  const m = marco(page);
  await expect(m.locator('#titulo')).toHaveText('Compra FE-0012');
  await expect(m.locator('#detalle')).toContainText('Vaso grande');
  await expect(m.locator('#detalle')).toContainText('$61.000');
  await expect(m.getByRole('link', { name: 'Ver recibo en PDF' })).toHaveAttribute('href', '/tienda/mi-cuenta/api/pedidos/12/recibo.pdf');
  v.sinProblemas();
});

test('«Mis datos» pinta lo del CRM como texto y guarda por el intermediario', async ({ page }) => {
  const v = vigilar(page);
  const llamadas = await api(page, { sesion: true });
  await abrirEnVentana(page, 'datos/');
  const m = marco(page);
  await expect(m.locator('#nombre')).toHaveValue('Ana <b>Pérez</b>');
  await expect(m.locator('#v-correo')).toHaveText('ana@ejemplo.com');
  /* Lo último escrito en la canasta de este celular deja de mandar: la canasta vuelve a proponer lo de la cuenta */
  await page.evaluate(() => localStorage.setItem('pe-cliente-v1', JSON.stringify({ cuenta: '1105678901', barrio: 'Viejo' })));
  await m.locator('#barrio').fill('  Fátima  ');
  const guardar = page.waitForRequest('**/tienda/mi-cuenta/api/datos');
  await m.locator('#f-datos button').first().click();
  expect((await guardar).postDataJSON()).toMatchObject({ barrio: 'Fátima' });
  await expect(m.locator('#ok-datos')).toBeVisible();
  expect(llamadas).toContain('POST datos');
  expect(await page.evaluate(() => localStorage.getItem('pe-cliente-v1'))).toBeNull();
  v.sinProblemas();
});

test('«Mis datos» con correo no lo deja cambiar ni lo manda al guardar', async ({ page }) => {
  await api(page, { sesion: true });
  await abrirEnVentana(page, 'datos/');
  const m = marco(page);
  await expect(m.locator('#v-correo')).toHaveText('ana@ejemplo.com');
  await expect(m.locator('#c-correo')).toBeHidden();
  const guardar = page.waitForRequest('**/tienda/mi-cuenta/api/datos');
  await m.locator('#f-datos button').first().click();
  expect((await guardar).postDataJSON()).not.toHaveProperty('correo');
});

test('una cuenta de antes, sin correo, lo pone en «Mis datos» y lo manda', async ({ page }) => {
  const v = vigilar(page);
  await api(page, { sesion: true, yo: { ...YO, correo: '' } });
  await abrirEnVentana(page, 'datos/');
  const m = marco(page);
  await expect(m.locator('#c-correo')).toBeVisible();
  await m.locator('#correo').fill('malo');
  await m.locator('#f-datos button').first().click();
  await expect(m.locator('#e-datos')).toHaveText('Revise el correo.');
  await m.locator('#correo').fill(' Ana@Nuevo.co ');
  const guardar = page.waitForRequest('**/tienda/mi-cuenta/api/datos');
  await m.locator('#f-datos button').first().click();
  expect((await guardar).postDataJSON()).toMatchObject({ correo: 'ana@nuevo.co' });
  v.sinProblemas();
});

const CUPON = { codigo: 'GRATIS-AB23CD', tipo: 'primer_domicilio', titulo: 'Primer domicilio gratis', detalle: 'No paga el domicilio de su próximo pedido.' };

test('«Cupones» sale en el menú con cuántos tiene y los muestra como texto', async ({ page }) => {
  const v = vigilar(page);
  await api(page, { sesion: true, yo: { ...YO, cupones: [{ ...CUPON, titulo: '<b>Primer</b> domicilio gratis' }] } });
  await page.goto('/tienda/');
  await page.locator('.cab .btn-cuenta').click();
  const opcion = page.locator('#menu-cuenta').getByRole('link', { name: /Cupones/ });
  await expect(opcion).toBeVisible();
  await expect(opcion.locator('.hay')).toHaveText('1');
  await opcion.click();
  const m = marco(page);
  await expect(m.locator('.cupon .titulo')).toHaveText('<b>Primer</b> domicilio gratis');
  await expect(m.locator('.cupon .codigo')).toHaveText('GRATIS-AB23CD');
  await expect(m.locator('.cupon')).toContainText('no tiene que escribirlo');
  v.sinProblemas();
});

test('sin cupones, «Cupones» lo dice; sin correo, lleva a «Mis datos»', async ({ page }) => {
  await api(page, { sesion: true, yo: { ...YO, correo: '', cupones: [] } });
  await abrirEnVentana(page, 'cupones/');
  const m = marco(page);
  await expect(m.locator('.vacio')).toContainText('Por ahora no tiene cupones.');
  await expect(m.getByRole('link', { name: 'Ir a Mis datos' })).toHaveAttribute('href', '/tienda/mi-cuenta/datos/');
});

test('si la sesión se vence con la ventana de Mi cuenta abierta, se va la página entera a la entrada', async ({ page }) => {
  const llamadas = await api(page, { sesion: true });
  await abrirEnVentana(page, 'pedidos/');
  await expect(marco(page).locator('#lista')).toContainText('FE-0012');
  await page.evaluate(() => fetch('/tienda/mi-cuenta/api/salir', { method: 'POST' }));   /* la sesión se acabó por fuera */
  await expect.poll(() => llamadas.includes('POST salir')).toBe(true);
  await marco(page).getByRole('link', { name: /FE-0012/ }).click();
  await expect(page).toHaveURL(/\/tienda\/mi-cuenta\/#cuenta=/);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('si el CRM no responde, el portal lo dice y no se queda cargando', async ({ page }) => {
  await sitioDe(page);
  await page.route('**/tienda/mi-cuenta/api/**', (r) => r.fulfill({ status: 502, json: { ok: false, error: 'No pudimos traer sus datos. Intente más tarde o escríbanos por WhatsApp al 318 355 5246.' } }));
  await abrirEnVentana(page, 'pedidos/');
  await expect(marco(page).locator('#lista')).toContainText('318 355 5246');
});

test('ninguna petición de la entrada ni del portal sale del propio sitio', async ({ page }) => {
  /** @type {string[]} */
  const fuera = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1') fuera.push(u.hostname); });
  await api(page);
  await page.goto('/tienda/mi-cuenta/');
  await page.waitForLoadState('networkidle');
  await page.goto('/tienda/mi-cuenta/#entrar');
  await entrar(page);
  await enLaTienda(page);
  for (const ruta of ['pedidos/', 'pedido/?id=12', 'datos/']) {
    await abrirEnVentana(page, ruta);
    await page.waitForLoadState('networkidle');
  }
  expect(fuera).toEqual([]);
});
