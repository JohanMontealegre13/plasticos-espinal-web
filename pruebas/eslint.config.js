// Lint del JavaScript del sitio. Solo reglas que atrapan errores reales
// (variables sin declarar, código muerto, comparaciones raras), no estilo.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/', '**/test-results/', '**/playwright-report/'] },
  js.configs.recommended,
  // Un catch que ignora el error a propósito (almacenamiento bloqueado, formulario dañado) es válido
  { rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] } },
  {
    // JS que corre en el navegador: script clásico (sin import/export)
    files: ['js/**/*.js', 'tienda/**/*.js'],
    languageOptions: { ecmaVersion: 2020, sourceType: 'script', globals: globals.browser },
  },
  {
    // Cloudflare Pages Functions: módulo ES con las APIs web (Request, crypto…)
    files: ['functions/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.serviceworker } },
  },
  {
    files: ['pruebas/**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
];
