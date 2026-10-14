import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { buildTruss2DWorkbook, SHEETS } from "@/lib/excel/truss-2d-workbook";
import { recalculate } from "@/lib/excel/testing/recalculate";
import { expectSameNumbers, rowNamed } from "@/lib/excel/testing/expectations";
import { cellAt, type WorkbookModel } from "@/lib/excel/workbook-model";
import { atomElements } from "./elements";
import { examples } from "./examples";
import { atomNodes, seedNodes } from "./nodes";
import { seedElements } from "./elements";
import type { PersistedModel } from "./persisted-model";
import { atomRestoreModel } from "./persistence";
import { atomResults } from "./results";

/**
 * La exportación a Excel promete que **el método sigue vivo en el libro**:
 * editar una coordenada, un área o una carga recalcula todo sin volver a la
 * app. Eso se prueba recalculando el libro con un motor de fórmulas que no es
 * el de la app (HyperFormula, ver `recalculate.ts`) y comparando contra el
 * motor — antes y después de editar.
 */

function solve(model: PersistedModel) {
  const store = createStore();
  store.set(atomRestoreModel, model);
  const results = store.get(atomResults);
  if (results.status !== "ok") throw new Error(`el modelo no resuelve: ${results.status}`);
  return { nodes: store.get(atomNodes), elements: store.get(atomElements), solved: results.solved };
}

function workbook(model: PersistedModel) {
  return buildTruss2DWorkbook(solve(model));
}

const seed: PersistedModel = { nodes: seedNodes(), elements: seedElements(), restrainedFirst: false, useDofNumbers: false };
const models: [string, PersistedModel][] = [
  ["ejemplo inicial", seed],
  ...examples.map((example): [string, PersistedModel] => [example.name, example.model]),
];
// El orden de los grados de libertad cambia dónde cae cada número en K y en la
// partición: es justo lo que el libro tiene que seguir bien.
const cases = models.flatMap(([name, model]) => [
  [name, model] as const,
  [`${name}, restringidos arriba`, { ...model, restrainedFirst: !model.restrainedFirst }] as const,
]);

/** La fila de la hoja Datos donde está un nudo o una barra. */
const dataRow = (model: WorkbookModel, name: string) => rowNamed(model, SHEETS.data, name);

describe("exportación de /armaduras-2d a Excel", () => {
  it.each(cases)("%s: cada fórmula recalcula a lo mismo que el motor", (_, model) => {
    const book = workbook(model);
    expect(expectSameNumbers(recalculate(book), book)).toBeGreaterThan(50);
  });

  it.each(cases)("%s: editar datos dentro del libro da lo mismo que resolver el modelo editado", (_, model) => {
    const book = workbook(model);
    const recalculated = recalculate(book);

    // Las cuatro clases de dato vivo, de una: geometría, sección, carga y
    // desplazamiento prescrito.
    const edited: PersistedModel = structuredClone(model);
    const loose = edited.nodes.find((node) => !node.restrainedX)!;
    loose.x += 0.5;
    recalculated.set(SHEETS.data, dataRow(book, loose.name), 2, loose.x);

    loose.forceX += 3;
    recalculated.set(SHEETS.data, dataRow(book, loose.name), 4, loose.forceX);

    const bar = edited.elements[0];
    bar.area *= 2;
    recalculated.set(SHEETS.data, dataRow(book, bar.name), 4, bar.area);

    const support = edited.nodes.find((node) => node.restrainedZ)!;
    support.displacementZ = -0.002;
    recalculated.set(SHEETS.data, dataRow(book, support.name), 9, support.displacementZ);

    expectSameNumbers(recalculated, workbook(edited));
  });

  it("no ofrece para editar lo que el cálculo ignoraría", () => {
    const book = workbook(seed);
    const data = book.sheets.find((sheet) => sheet.name === SHEETS.data)!;
    const v1 = dataRow(book, "v1"); // apoyo fijo en los dos ejes
    const v3 = dataRow(book, "v3"); // libre en los dos ejes

    // La carga sobre un apoyo la toma el apoyo; el desplazamiento prescrito
    // sobre un grado libre no existe.
    expect(cellAt(data, v1, 4)?.role).toBe("fixed");
    expect(cellAt(data, v1, 8)?.role).toBe("input");
    expect(cellAt(data, v3, 4)?.role).toBe("input");
    expect(cellAt(data, v3, 8)?.role).toBe("fixed");
    // Los apoyos se muestran, no se editan: cambiarlos es otro libro.
    expect(cellAt(data, v1, 6)?.role).toBe("fixed");
  });
});
