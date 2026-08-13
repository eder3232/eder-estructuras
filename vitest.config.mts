import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * El entorno por defecto sigue siendo `node`, que es donde corren los tests de
 * motor y de stores (la gran mayoría). Los tests de componentes piden su entorno
 * **por archivo**, con el docblock:
 *
 * ```ts
 * // @vitest-environment happy-dom
 * ```
 *
 * Es a propósito y no un atajo. Las otras dos salidas eran `environmentMatchGlobs`,
 * que Vitest 4 sacó, y `test.projects`, que obliga a mantener dos configuraciones
 * paralelas para ganar lo mismo. El docblock deja la elección a la vista del que
 * abre el archivo.
 *
 * Por la misma razón no hay `setupFiles`: un archivo de setup corre para *todos*
 * los tests, así que importar ahí `@testing-library/react` metería DOM en los que
 * corren en `node`. Cada test de componente hace su propio `afterEach(cleanup)`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
