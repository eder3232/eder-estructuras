import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { seedElements } from "./elements";
import { seedNodes } from "./nodes";
import { atomRestoreModel } from "./persistence";
import { atomResults } from "./results";

/**
 * Los mensajes del motor se arman con ids (`seed-e1`), y llegaban así a la
 * pantalla aunque el título del aviso dijera bien «e1». Se encontró revisando
 * `/springs` el 2026-10-14; ver `src/lib/display-names.ts`.
 */
describe("/armaduras-2d — los errores nombran filas, no ids internos", () => {
  it("un área no positiva se reporta con el nombre de la barra", () => {
    const model = { nodes: seedNodes(), elements: seedElements(), restrainedFirst: false, useDofNumbers: false };
    model.elements[0].area = 0;
    const store = createStore();
    store.set(atomRestoreModel, model);
    const results = store.get(atomResults);
    if (results.status !== "error") throw new Error(results.status);
    expect(results.errors[0].message).toBe("El elemento e1 debe tener área positiva.");
  });
});
