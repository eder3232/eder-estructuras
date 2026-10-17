import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { buildTruss3DWorkbook, TRUSS_3D_SHEETS } from "@/lib/excel/truss-3d-workbook";
import { expectSameNumbers, rowNamed } from "@/lib/excel/testing/expectations";
import { recalculate } from "@/lib/excel/testing/recalculate";
import { cellAt, type WorkbookModel } from "@/lib/excel/workbook-model";
import { seedElements } from "./elements";
import { examples } from "./examples";
import { seedNodes, seedNodeIds } from "./nodes";
import type { PersistedModel } from "./persisted-model";
import { atomRestoreModel } from "./persistence";
import { atomResults } from "./results";

/**
 * El libro de `/armaduras-3d` promete lo mismo que el de `/armaduras-2d`: que
 * el método sigue vivo. Se prueba igual — recalculándolo con HyperFormula, un
 * motor de fórmulas que no es el de la app, antes y después de editar.
 */

function workbook(model: PersistedModel) {
  const store = createStore();
  store.set(atomRestoreModel, model);
  const results = store.get(atomResults);
  if (results.status !== "ok") throw new Error(`el modelo no resuelve: ${results.status}`);
  return buildTruss3DWorkbook({ nodes: model.nodes, elements: model.elements, solved: results.solved });
}

const dataRow = (model: WorkbookModel, name: string) => rowNamed(model, TRUSS_3D_SHEETS.data, name);

// Columnas de la hoja Datos (ver `truss-3d-workbook.ts`).
const COL = { x: 2, y: 3, z: 4, forceX: 5, forceY: 6, forceZ: 7, prescribedZ: 13, area: 4 } as const;

const seed: PersistedModel = { nodes: seedNodes(), elements: seedElements(), restrainedFirst: false, useDofNumbers: false };
// El tetraedro aplastado no está: es un mecanismo a propósito, y sin solución
// el botón no se habilita.
const models: [string, PersistedModel][] = [
  ["ejemplo inicial", seed],
  ...examples.filter((e) => e.id !== "aplastado").map((e): [string, PersistedModel] => [e.name, e.model]),
];
const cases = models.flatMap(([name, model]) => [
  [name, model] as const,
  [`${name}, restringidos arriba`, { ...model, restrainedFirst: !model.restrainedFirst }] as const,
]);

describe("exportación de /armaduras-3d a Excel", () => {
  it.each(cases)("%s: cada fórmula recalcula a lo mismo que el motor", (_, model) => {
    const book = workbook(model);
    expect(expectSameNumbers(recalculate(book), book)).toBeGreaterThan(80);
  });

  it.each(cases)("%s: editar datos dentro del libro da lo mismo que resolver el modelo editado", (_, model) => {
    const book = workbook(model);
    const recalculated = recalculate(book);

    // Las cuatro clases de dato vivo: geometría (en y, el eje que 2D no tiene),
    // carga, sección y desplazamiento prescrito.
    const edited: PersistedModel = structuredClone(model);
    const loose = edited.nodes.find((node) => !node.restrainedX && !node.restrainedY)!;
    loose.y += 0.3;
    recalculated.set(TRUSS_3D_SHEETS.data, dataRow(book, loose.name), COL.y, loose.y);

    loose.forceY += 3;
    recalculated.set(TRUSS_3D_SHEETS.data, dataRow(book, loose.name), COL.forceY, loose.forceY);

    const bar = edited.elements[0];
    bar.area *= 2;
    recalculated.set(TRUSS_3D_SHEETS.data, dataRow(book, bar.name), COL.area, bar.area);

    const support = edited.nodes.find((node) => node.restrainedZ)!;
    support.displacementZ = -0.002;
    recalculated.set(TRUSS_3D_SHEETS.data, dataRow(book, support.name), COL.prescribedZ, support.displacementZ);

    expectSameNumbers(recalculated, workbook(edited));
  });

  it("no ofrece para editar lo que el cálculo ignoraría, y no trae imagen", () => {
    const book = workbook(seed);
    const data = book.sheets.find((sheet) => sheet.name === TRUSS_3D_SHEETS.data)!;
    const c = dataRow(book, seedNodes().find((n) => n.id === seedNodeIds.c)!.name); // libre en x e y, apoyado en z

    expect(cellAt(data, c, COL.forceX)?.role).toBe("input");
    expect(cellAt(data, c, COL.forceZ)?.role).toBe("fixed");
    expect(cellAt(data, c, COL.prescribedZ)?.role).toBe("input");
    expect(cellAt(data, c, COL.prescribedZ - 2)?.role).toBe("fixed"); // prescrito en x: no aplica
    expect(book.sheets.every((sheet) => sheet.images.length === 0)).toBe(true);
  });
});
