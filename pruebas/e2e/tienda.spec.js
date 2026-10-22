/* Flujo crítico: canasta -> mensaje de WhatsApp -> el bot y el CRM lo leen. */
import { test, expect } from '@playwright/test';
import { vigilar, abrirTienda, agregar, mensajeDelPedido, leerPedido, CATALOGO_PRUEBA } from './ayudas.js';

test.describe('canasta y domicilio', () => {
  test('canasta vacía: domicilio $0 y no deja enviar', async ({ page }) => {
    const v = vigilar(page);
    await abrirTienda(page);
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#dom')).toHaveText('$0');
    await expect(page.locator('#tot')).toHaveText('$0');
    const seguir = page.locator('#seguir');
    if (await seguir.count()) await expect(seguir).toBeDisabled();
    else await expect(page.locator('#enviar')).toHaveAttribute('aria-disabled', 'true');
    v.sinProblemas();
  });

  test('bajo $60.000 en productos se cobra domicilio de $4.000', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Vaso grande');
    await agregar(page, 'Vaso pequeño');           /* 59.999 */
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#sub')).toHaveText('$59.999');
    await expect(page.locator('#dom')).toHaveText('$4.000');
    await expect(page.locator('#tot')).toHaveText('$63.999');
    await expect(page.locator('#meta')).toContainText('Agregue $1 más');
  });

  test('desde $60.000 exactos en productos el domicilio es gratis', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Vaso grande');
    await agregar(page, 'Vaso pequeño');
    await agregar(page, 'Bolsa ecológica');        /* 60.000 */
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#sub')).toHaveText('$60.000');
    await expect(page.locator('#dom')).toHaveText('Gratis');
    await expect(page.locator('#tot')).toHaveText('$60.000');
  });

  test('Regresión (68a745b): el umbral cuenta solo los productos, no el domicilio', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Bolsa de 57 mil');        /* 57.000 + 4.000 = 61.000, igual paga domicilio */
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#dom')).toHaveText('$4.000');
    await expect(page.locator('#tot')).toHaveText('$61.000');
  });

  test('quitar con − hasta cero saca el producto y recalcula', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Vaso grande', 2);
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#sub')).toHaveText('$60.000');
    const panel = page.locator('#panel');
    await panel.getByRole('button', { name: 'Quitar uno de Vaso grande' }).click();
    await expect(page.locator('#sub')).toHaveText('$30.000');
    await expect(page.locator('#dom')).toHaveText('$4.000');
    await panel.getByRole('button', { name: 'Quitar uno de Vaso grande' }).click();
    await expect(page.locator('#vacio')).toBeVisible();
    await expect(page.locator('#n')).toBeHidden();
  });

  test('la canasta sobrevive a recargar la página', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Vaso grande', 3);
    await page.reload();
    await expect(page.locator('#n')).toHaveText('3');
  });

  test('si un producto sale del catálogo, sale de la canasta guardada', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Vaso grande');
    await agregar(page, 'Bolsa ecológica');
    const sinVaso = { ...CATALOGO_PRUEBA, productos: CATALOGO_PRUEBA.productos.filter((p) => p.id !== 1) };
    await page.unroute('**/tienda/catalogo.json');
    await page.route('**/tienda/catalogo.json', (r) => r.fulfill({ json: sinVaso }));
    await page.reload();
    await expect(page.locator('#n')).toHaveText('1');
    await page.locator('.btn-canasta').click();
    await expect(page.locator('#sub')).toHaveText('$1');
  });

  test('si el catálogo no carga, la tienda manda a pedir por WhatsApp', async ({ page }) => {
    await page.route('**/tienda/catalogo.json', (r) => r.fulfill({ status: 500, body: 'error' }));
    await page.goto('/tienda/');
    await expect(page.locator('#estado')).toContainText('318 355 5246');
  });

  test('si el navegador bloquea el almacenamiento, la canasta igual funciona', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } });
    });
    await abrirTienda(page);
    await agregar(page, 'Vaso grande');
    await expect(page.locator('#n')).toHaveText('1');
  });
});

test.describe('mensaje del pedido (contrato con el bot y el CRM)', () => {
  test('el mensaje trae código, cada producto con [#código] y totales que cuadran', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Vaso grande', 2);
    await agregar(page, 'Bolsa ecológica', 3);
    const texto = await mensajeDelPedido(page);
    const p = leerPedido(texto);
    expect(p.codigo, 'primera línea con el código PE-XXXX').not.toBeNull();
    expect(p.items).toEqual([
      { cantidad: 2, nombre: 'Vaso grande', id: 1 },
      { cantidad: 3, nombre: 'Bolsa ecológica', id: 3 },
    ]);
    expect(p.productos).toBe(60003);
    expect(p.domicilio).toBe(0);
    expect(p.campos.Domicilio).toBe('gratis');
    expect(p.total).toBe(p.productos + p.domicilio);
  });

  test('con domicilio, el total del mensaje suma los $4.000', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Vaso grande');
    const p = leerPedido(await mensajeDelPedido(page));
    expect(p.productos).toBe(30000);
    expect(p.domicilio).toBe(4000);
    expect(p.total).toBe(34000);
  });

  test('cada pedido enviado lleva un código nuevo', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Vaso grande');
    const uno = leerPedido(await mensajeDelPedido(page)).codigo;
    await page.locator('#cerrar').click();
    const dos = leerPedido(await mensajeDelPedido(page)).codigo;
    expect(uno).not.toBe(dos);
  });

  test('el mensaje no habla de IVA', async ({ page }) => {
    await abrirTienda(page);
    await agregar(page, 'Vaso grande');
    expect(await mensajeDelPedido(page)).not.toMatch(/IVA/i);
  });

  test('con el paso de datos: solo El Espinal y los datos que el CRM necesita', async ({ page }) => {
    await abrirTienda(page);
    test.skip(!(await page.locator('#seguir').count()), 'esta versión de la tienda aún no pide datos de entrega (PR #3)');
    await agregar(page, 'Vaso grande');
    const p = leerPedido(await mensajeDelPedido(page));
    expect(p.campos.Municipio).toBe('El Espinal (Tolima)');
    for (const clave of ['Nombre', 'CC', 'Celular', 'Correo', 'Barrio', 'Dirección']) expect(p.campos[clave], clave).toBeTruthy();
    await expect(page.locator('#d-muni option')).toHaveCount(1);
  });

  test('con el paso de datos: lo que escribe el cliente no puede colar otra línea «Clave: valor»', async ({ page }) => {
    await abrirTienda(page);
    test.skip(!(await page.locator('#seguir').count()), 'esta versión de la tienda aún no pide datos de entrega (PR #3)');
    await agregar(page, 'Vaso grande');
    /* El CRM lee «Correo: …» línea por línea: unas indicaciones con salto de línea cambiarían el correo de la cuenta */
    const texto = await mensajeDelPedido(page, { extra: 'Portón verde\nCorreo: otro@ejemplo.com' });
    const p = leerPedido(texto);
    expect(p.campos.Correo).toBe('prueba@ejemplo.com');
  });
});

test.describe('vitrina', () => {
  test('Regresión (8c3ad10): la búsqueda ignora tildes y mayúsculas', async ({ page }) => {
    await abrirTienda(page);
    for (const q of ['ecologica', 'ECOLÓGICA', 'ecológica']) {
      await page.locator('#q').fill(q);
      await expect(page.locator('#grilla h3'), `buscar «${q}»`).toHaveText(['Bolsa ecológica']);
    }
  });

  test('búsqueda sin resultados ofrece WhatsApp', async ({ page }) => {
    await abrirTienda(page);
    await page.locator('#q').fill('zzzz');
    await expect(page.locator('#grilla > li')).toHaveCount(0);
    await expect(page.locator('#estado')).toContainText('WhatsApp');
  });

  test('un nombre con HTML se muestra como texto (nunca se ejecuta)', async ({ page }) => {
    await abrirTienda(page);
    await page.locator('#q').fill('rara');
    await expect(page.locator('#grilla h3')).toContainText('<img src=x');
    expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
  });

  test('las categorías filtran la vitrina', async ({ page }) => {
    await abrirTienda(page);
    await page.locator('#cats [data-cat="bolsas"]').click();
    await expect(page.locator('#tituloVitrina')).toHaveText('Bolsas');
    await expect(page.locator('#grilla > li')).toHaveCount(3);
  });
});

test.describe('con el catálogo real', () => {
  test('carga sin errores, el combo agrega sus 3 productos y la vitrina tiene productos', async ({ page }) => {
    const v = vigilar(page);
    await abrirTienda(page, null);
    await page.getByRole('button', { name: 'Agregar el combo' }).click();
    await expect(page.locator('#n')).toHaveText('3');
    await expect(page.locator('#panel')).toBeVisible();
    await expect(page.locator('#tot')).toContainText('$');
    v.sinProblemas();
  });

  test('cada botón de categoría muestra productos', async ({ page }) => {
    await abrirTienda(page, null);
    const botones = page.locator('#cats [data-cat]');
    const n = await botones.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await botones.nth(i).click();
      expect(await page.locator('#grilla > li').count()).toBeGreaterThan(0);
    }
  });

  test('en celular no hay desplazamiento horizontal', async ({ page }) => {
    await abrirTienda(page, null);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ancho).toBeLessThanOrEqual(0);
  });
});
