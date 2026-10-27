/* Ubicación de entrega: el cliente puede adjuntar su punto del GPS a los datos de entrega, solo si cae
   dentro de El Espinal. El enlace del mapa va PRIMERO en las indicaciones (el CRM las corta a 300) y nunca
   se corta. Si el GPS se niega o no responde, se puede pedir igual. */
import { test, expect } from '@playwright/test';
import { abrirTienda, llenarDatos, vigilar } from './ayudas.js';

const PRODUCTO = 'Agregar Contenedor icopor J1 x25 und a la canasta';
const ENLACE = 'https://maps.google.com/?q=4.15000,-74.88500';
const PROPOSITO = 'Solo la usamos para llevarle el pedido.';
const NO_PUDIMOS = 'No pudimos tomar su ubicación. Escriba la dirección y siga.';
const FUERA = 'Esa ubicación queda fuera de El Espinal. Escriba la dirección donde lo recibe.';
const IMPRECISA = 'Su ubicación salió imprecisa. Escriba la dirección o intente otra vez con el GPS encendido.';

/** Simula el CRM: guarda lo que se le manda en `enviados` y responde que el pedido llegó. */
async function simularPedido(/** @type {import('@playwright/test').Page} */ page) {
  /** @type {any[]} */
  const enviados = [];
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido', async (r) => {
    enviados.push(r.request().postDataJSON());
    await r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE', secreto: 's', total: 13800 } });
  });
  return enviados;
}

/** Agrega un producto, abre la canasta y toca «Pedir ya»: queda a la vista el formulario de entrega. */
async function hastaLosDatos(/** @type {import('@playwright/test').Page} */ page) {
  await page.getByRole('button', { name: PRODUCTO }).click();
  await page.locator('.btn-canasta').click();
  await page.locator('#seguir').click();
  await expect(page.locator('#datos')).toBeVisible();
}

/**
 * Cambia el GPS del navegador por uno de mentira. Cada toque de «Usar mi ubicación» toma la siguiente
 * respuesta (la última se repite): { lat, lng } responde con ese punto (con `precision`, el radio de error
 * en metros que da el teléfono; si no, 10 m, como un GPS bueno), { codigo } con ese error del
 * navegador (1 permiso negado, 2 sin señal, 3 no respondió a tiempo) y 'espera' se queda esperando
 * hasta que la prueba llame a window.__gpsResponder(respuesta).
 * @param {import('@playwright/test').Page} page
 * @param {(({ lat: number, lng: number, precision?: number } | { codigo: number } | 'espera'))[]} respuestas
 */
async function gpsFalso(page, respuestas) {
  await page.addInitScript((lista) => {
    let n = 0, pendiente = null;
    const entregar = (ok, error, r) => {
      if ('codigo' in r) error({ code: r.codigo, message: 'simulado', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      else ok({ coords: { latitude: r.lat, longitude: r.lng, accuracy: 'precision' in r ? r.precision : 10 }, timestamp: Date.now() });
    };
    // @ts-ignore
    window.__gpsPedidos = [];
    // @ts-ignore
    window.__gpsResponder = (r) => { const p = pendiente; pendiente = null; entregar(p[0], p[1], r); };
    const falso = {
      getCurrentPosition(ok, error, opciones) {
        // @ts-ignore
        window.__gpsPedidos.push(opciones);
        const r = lista[Math.min(n++, lista.length - 1)];
        if (r === 'espera') pendiente = [ok, error];
        else setTimeout(() => entregar(ok, error, r), 0);
      },
    };
    Object.defineProperty(navigator, 'geolocation', { value: falso, configurable: true });
  }, respuestas);
}

/* ---------- lo pedido en la tarea ---------- */

test('con ubicación en El Espinal el pedido lleva el enlace primero', async ({ page, context }) => {
  const v = vigilar(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 4.1500, longitude: -74.8850 });
  const enviados = await simularPedido(page);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#d-extra').fill('Casa azul, frente a la tienda');
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados).toHaveLength(1);
  expect(enviados[0].indicaciones).toBe(ENLACE + ' · Casa azul, frente a la tienda');
  expect(enviados[0].indicaciones.startsWith('https://maps.google.com/?q=4.15000,-74.88500')).toBe(true);
  v.sinProblemas();
});

test('sin permiso de ubicación se puede pedir igual', async ({ page }) => {
  const v = vigilar(page);
  const enviados = await simularPedido(page);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#d-extra').fill('Casa azul');
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText(NO_PUDIMOS);
  await expect(page.locator('#ubicar')).toBeEnabled();
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados).toHaveLength(1);
  expect(enviados[0].indicaciones).toBe('Casa azul');
  v.sinProblemas();
});

test('una ubicación lejos (Bogotá) no se adjunta', async ({ page, context }) => {
  const v = vigilar(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 4.711, longitude: -74.072 });
  const enviados = await simularPedido(page);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText(FUERA);
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).not.toContain('maps.google.com');
  expect(enviados[0].indicaciones).toBe('');
  v.sinProblemas();
});

/* ---------- el enlace va primero y no se corta ---------- */

test('con indicaciones de 300 caracteres el enlace entra completo y se corta el texto', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 4.1500, longitude: -74.8850 });
  const enviados = await simularPedido(page);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#d-extra').fill('x'.repeat(300));
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toHaveLength(300);
  expect(enviados[0].indicaciones.startsWith(ENLACE + ' · x')).toBe(true);
});

/* ---------- lo que se guarda en el celular ---------- */

test('el enlace del mapa no se guarda en los datos del celular', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 4.1500, longitude: -74.8850 });
  await simularPedido(page);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#d-extra').fill('Casa azul');
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  const todo = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  expect(todo).not.toContain('maps.google.com');
  expect(todo).not.toContain('4.15000');
  const datos = await page.evaluate(() => JSON.parse(localStorage.getItem('pe-cliente-v1')));
  expect(datos.extra).toBe('Casa azul');
});

test('la ubicación es de ese pedido: el siguiente no la lleva', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 4.1500, longitude: -74.8850 });
  const enviados = await simularPedido(page);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toBe(ENLACE);
  /* otro pedido: los datos vuelven solos, la ubicación no */
  await page.locator('#cerrar').click();
  await hastaLosDatos(page);
  await expect(page.locator('#ubicado')).toHaveText('');
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados).toHaveLength(2);
  expect(enviados[1].indicaciones).toBe('');
});

test('si el pedido no pudo enviarse, la ubicación sigue lista para reintentar', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 4.1500, longitude: -74.8850 });
  /** @type {any[]} */
  const enviados = [];
  await page.route('**/tienda/mi-cuenta/api/tienda/pedido', async (r) => {
    enviados.push(r.request().postDataJSON());
    if (enviados.length === 1) await r.fulfill({ status: 500, json: { ok: false, error: 'Intente otra vez.' } });
    else await r.fulfill({ json: { ok: true, codigo: 'PE-ABCDE', secreto: 's', total: 13800 } });
  });
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#enviar').click();
  await expect(page.locator('#errores')).toHaveText('Intente otra vez.');
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados.map((e) => e.indicaciones)).toEqual([ENLACE, ENLACE]);
});

/* ---------- el GPS falla, tarda o cambia ---------- */

for (const [que, codigo] of [['el permiso se niega', 1], ['no hay señal', 2], ['no responde a tiempo', 3]]) {
  test(`si ${que} (${codigo}) se avisa y se puede pedir igual`, async ({ page }) => {
    const enviados = await simularPedido(page);
    await gpsFalso(page, [{ codigo }]);
    await abrirTienda(page);
    await hastaLosDatos(page);
    await llenarDatos(page);
    await page.locator('#ubicar').click();
    await expect(page.locator('#ubicado')).toHaveText(NO_PUDIMOS);
    await expect(page.locator('#ubicar')).toBeEnabled();
    await page.locator('#enviar').click();
    await expect(page.locator('#pago')).toBeVisible();
    expect(enviados[0].indicaciones).toBe('');
  });
}

test('pide el GPS con los valores acordados', async ({ page }) => {
  await gpsFalso(page, [{ lat: 4.15, lng: -74.885 }]);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  expect(await page.evaluate(() => /** @type {any} */ (window).__gpsPedidos)).toEqual([{ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }]);
});

test('una ubicación nueva que falla borra la anterior: nunca viaja un punto viejo', async ({ page }) => {
  const enviados = await simularPedido(page);
  await gpsFalso(page, [{ lat: 4.15, lng: -74.885 }, { codigo: 1 }]);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText(NO_PUDIMOS);
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toBe('');
});

test('una ubicación nueva que cae fuera de El Espinal también borra la anterior', async ({ page }) => {
  const enviados = await simularPedido(page);
  await gpsFalso(page, [{ lat: 4.15, lng: -74.885 }, { lat: 4.711, lng: -74.072 }]);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText(FUERA);
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toBe('');
});

test('tocar otra vez reemplaza la ubicación anterior', async ({ page }) => {
  const enviados = await simularPedido(page);
  await gpsFalso(page, [{ lat: 4.15, lng: -74.885 }, { lat: 4.1530, lng: -74.8800 }]);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toBe('https://maps.google.com/?q=4.15300,-74.88000');
});

test('mientras espera el GPS dice que busca y no deja tocar dos veces', async ({ page }) => {
  await gpsFalso(page, ['espera']);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Buscando su ubicación…');
  await expect(page.locator('#ubicar')).toBeDisabled();
  await page.evaluate(() => /** @type {any} */ (window).__gpsResponder({ lat: 4.15, lng: -74.885 }));
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await expect(page.locator('#ubicar')).toBeEnabled();
});

test('una respuesta del GPS que llega después de enviar el pedido no se cuela en el siguiente', async ({ page }) => {
  const enviados = await simularPedido(page);
  await gpsFalso(page, ['espera']);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Buscando su ubicación…');
  await page.locator('#enviar').click();                       /* pide sin esperar */
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toBe('');
  await page.evaluate(() => /** @type {any} */ (window).__gpsResponder({ lat: 4.15, lng: -74.885 }));
  await page.locator('#cerrar').click();
  await hastaLosDatos(page);
  await expect(page.locator('#ubicado')).toHaveText('');
  await expect(page.locator('#ubicar')).toBeEnabled();
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[1].indicaciones).toBe('');
});

/* ---------- un punto impreciso (por antena o por internet) no sirve para llegar ---------- */

test('una ubicación imprecisa no se adjunta y pide escribir la dirección, sin cifras', async ({ page }) => {
  const v = vigilar(page);
  const enviados = await simularPedido(page);
  await gpsFalso(page, [{ lat: 4.15, lng: -74.885, precision: 1500 }]);   /* cae dentro del radio, pero ±1,5 km */
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#d-extra').fill('Casa azul');
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText(IMPRECISA);
  await expect(page.locator('#ubicado')).not.toHaveText(/\d/);          /* sin metros ni números en pantalla */
  await expect(page.locator('#ubicar')).toBeEnabled();                 /* se puede intentar otra vez */
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toBe('Casa azul');
  v.sinProblemas();
});

test('una ubicación imprecisa después de una buena borra la buena; con el GPS bien se puede otra vez', async ({ page }) => {
  const enviados = await simularPedido(page);
  await gpsFalso(page, [{ lat: 4.15, lng: -74.885 }, { lat: 4.153, lng: -74.88, precision: 3000 }, { lat: 4.153, lng: -74.88, precision: 200 }]);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText(IMPRECISA);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText('Ubicación lista ✓');   /* hasta 200 m todavía sirve */
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toBe('https://maps.google.com/?q=4.15300,-74.88000');
});

test('imprecisa y además lejos: manda la imprecisión, no se adjunta nada', async ({ page }) => {
  const enviados = await simularPedido(page);
  await gpsFalso(page, [{ lat: 4.711, lng: -74.072, precision: 5000 }]);
  await abrirTienda(page);
  await hastaLosDatos(page);
  await llenarDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText(IMPRECISA);
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toBe('');
});

/* ---------- cuando no se puede pedir la ubicación ---------- */

test('sin GPS en el navegador no sale el botón y el pedido sigue igual', async ({ page }) => {
  const enviados = await simularPedido(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true }));
  await abrirTienda(page);
  await hastaLosDatos(page);
  await expect(page.locator('#ubicar')).toBeHidden();
  await expect(page.getByText(PROPOSITO)).toBeHidden();
  await llenarDatos(page);
  await page.locator('#d-extra').fill('Casa azul');
  await page.locator('#enviar').click();
  await expect(page.locator('#pago')).toBeVisible();
  expect(enviados[0].indicaciones).toBe('Casa azul');
});

test('si "entrega" falta en catalogo.json no sale el botón', async ({ page }) => {
  await abrirTienda(page, { sitio: (sitio) => { delete sitio.entrega; } });
  await hastaLosDatos(page);
  await expect(page.locator('#ubicar')).toBeHidden();
});

test('si "entrega" viene dañada no sale el botón', async ({ page }) => {
  await abrirTienda(page, { sitio: (sitio) => { sitio.entrega = { tienda: { lat: 'aquí', lng: null }, radio_km: 'cerca' }; } });
  await hastaLosDatos(page);
  await expect(page.locator('#ubicar')).toBeHidden();
});

test('el radio sale de catalogo.json: con un radio de 1 km, un punto a 1,5 km queda fuera', async ({ page }) => {
  await gpsFalso(page, [{ lat: 4.1525081 + 0.0135, lng: -74.8828245 }]);   /* ~1,5 km al norte de la tienda */
  await abrirTienda(page, { sitio: (sitio) => { sitio.entrega.radio_km = 1; } });
  await hastaLosDatos(page);
  await page.locator('#ubicar').click();
  await expect(page.locator('#ubicado')).toHaveText(FUERA);
});

/* ---------- lo que se ve ---------- */

test('el botón y su aviso: dicen para qué, miden 44 px o más y caben en la pantalla', async ({ page }) => {
  const v = vigilar(page);
  await abrirTienda(page);
  await hastaLosDatos(page);
  const boton = page.locator('#ubicar');
  await expect(boton).toBeVisible();
  await expect(boton).toHaveText('📍 Usar mi ubicación actual');
  await expect(page.getByText(PROPOSITO)).toBeVisible();
  await expect(page.locator('#ubicado')).toHaveAttribute('role', 'status');
  const caja = await boton.boundingBox();
  expect(caja.height).toBeGreaterThanOrEqual(44);
  expect(caja.width).toBeGreaterThanOrEqual(44);
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(ancho, 'la pantalla no debe desbordar a los lados').toBe(true);
  /* el botón se puede alcanzar con el teclado */
  await boton.focus();
  await expect(boton).toBeFocused();
  v.sinProblemas();
});
