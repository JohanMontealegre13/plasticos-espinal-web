/* Foto de perfil: opcional, se pone SOLO tocando el círculo de la inicial en el menú de la cuenta y se quita
   con «Quitar foto». Antes de mandarla se achica aquí (cuadrada, JPEG); el CRM la guarda y solo se la da a su dueño. */
import { test, expect } from '@playwright/test';
import { abrirTienda, vigilar, CUENTA } from './ayudas.js';

/* Un PNG de 2x1 píxeles (rojo y azul): basta para probar el recorte cuadrado */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAEUlEQVR4nGP4z8DAwMDwn4EBAA/+Af9vVRe1AAAAAElFTkSuQmCC', 'base64');
const NOMBRE = 'a'.repeat(32) + '.jpg';

/** Simula el CRM de la foto: anota lo que llega y responde como él. */
async function simularFoto(/** @type {import('@playwright/test').Page} */ page) {
  /** @type {{ puestas: any[], quitadas: number }} */
  const r = { puestas: [], quitadas: 0 };
  await page.route('**/tienda/mi-cuenta/api/foto', async (x) => {
    r.puestas.push(x.request().postDataJSON());
    await x.fulfill({ json: { ok: true, foto: NOMBRE } });
  });
  await page.route('**/tienda/mi-cuenta/api/foto/quitar', async (x) => { r.quitadas++; await x.fulfill({ json: { ok: true, foto: '' } }); });
  await page.route('**/tienda/mi-cuenta/api/foto/*.jpg', (x) => x.fulfill({ body: PNG, contentType: 'image/png' }));
  return r;
}

async function abrirMenu(/** @type {import('@playwright/test').Page} */ page) {
  await page.locator('.cab .btn-cuenta').click();
  await expect(page.locator('#menu-cuenta')).toBeVisible();
}

test('sin foto, el círculo del menú muestra la inicial y tocarlo pide la foto; queda arriba y en el menú', async ({ page }) => {
  const v = vigilar(page);
  const crm = await simularFoto(page);
  await abrirTienda(page, { cuenta: { ...CUENTA, foto: '' } });
  await abrirMenu(page);
  const circulo = page.locator('#menu-cuenta .foto-yo');
  await expect(circulo).toHaveText('A');
  await expect(circulo).toHaveAccessibleName('Poner mi foto de perfil');
  await expect(page.locator('#menu-cuenta .quitar-foto')).toHaveCount(0);   /* sin foto no hay «Quitar» */
  const escoger = page.waitForEvent('filechooser');
  await circulo.click();
  await (await escoger).setFiles({ name: 'yo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#menu-cuenta .aviso-foto')).toHaveText('Foto guardada ✓');
  expect(crm.puestas).toHaveLength(1);
  expect(crm.puestas[0].imagen).toMatch(/^data:image\/jpeg;base64,/);
  /* va cuadrada: el recorte es del lado corto */
  const lado = await page.evaluate((src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = src; }), crm.puestas[0].imagen);
  expect(lado).toEqual([1, 1]);
  await expect(page.locator('#menu-cuenta .foto-yo img')).toHaveAttribute('src', /\/api\/foto\/a{32}\.jpg$/);
  await expect(page.locator('#yo img')).toHaveAttribute('src', /\/api\/foto\/a{32}\.jpg$/);
  await expect(page.locator('#menu-cuenta .quitar-foto')).toBeVisible();
  v.sinProblemas();
});

test('con foto, sale arriba al abrir la tienda y «Quitar foto» vuelve a la inicial', async ({ page }) => {
  const crm = await simularFoto(page);
  await abrirTienda(page, { cuenta: { ...CUENTA, foto: NOMBRE } });
  await expect(page.locator('#yo img')).toBeVisible();
  await abrirMenu(page);
  await expect(page.locator('#menu-cuenta .foto-yo')).toHaveAccessibleName('Cambiar mi foto de perfil');
  await page.locator('#menu-cuenta .quitar-foto').click();
  expect(crm.quitadas).toBe(1);
  await expect(page.locator('#yo img')).toHaveCount(0);
  await expect(page.locator('#yo')).toHaveText('A');
  await expect(page.locator('#menu-cuenta .foto-yo')).toHaveText('A');
  await expect(page.locator('#menu-cuenta .foto-yo')).toBeFocused();
  await expect(page.locator('#menu-cuenta .quitar-foto')).toHaveCount(0);
});

test('si el CRM no acepta la foto lo dice y no cambia nada', async ({ page }) => {
  await page.route('**/tienda/mi-cuenta/api/foto', (x) => x.fulfill({ status: 400, json: { ok: false, error: 'Eso no es una foto que podamos usar.' } }));
  await abrirTienda(page, { cuenta: { ...CUENTA, foto: '' } });
  await abrirMenu(page);
  const escoger = page.waitForEvent('filechooser');
  await page.locator('#menu-cuenta .foto-yo').click();
  await (await escoger).setFiles({ name: 'yo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#menu-cuenta .aviso-foto')).toHaveText('Eso no es una foto que podamos usar.');
  await expect(page.locator('#menu-cuenta .foto-yo')).toBeEnabled();
  await expect(page.locator('#yo img')).toHaveCount(0);
});

test('un archivo que no es foto no se manda', async ({ page }) => {
  const crm = await simularFoto(page);
  await abrirTienda(page, { cuenta: { ...CUENTA, foto: '' } });
  await abrirMenu(page);
  const escoger = page.waitForEvent('filechooser');
  await page.locator('#menu-cuenta .foto-yo').click();
  await (await escoger).setFiles({ name: 'hoja.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(page.locator('#menu-cuenta .aviso-foto')).toHaveText('Escoja una foto JPG, PNG o WebP.');
  expect(crm.puestas).toHaveLength(0);
});

test('mientras el CRM no sepa de fotos (yo sin «foto»), el menú sigue como antes, sin círculo', async ({ page }) => {
  await abrirTienda(page);
  await abrirMenu(page);
  await expect(page.locator('#menu-cuenta')).toContainText('Ana');
  await expect(page.locator('#menu-cuenta .foto-yo')).toHaveCount(0);
});
