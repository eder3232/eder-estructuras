import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { buildSpringsWorkbook, SPRINGS_SHEETS } from "@/lib/excel/springs-workbook";
import { expectSameNumbers, rowNamed } from "@/lib/excel/testing/expectations";
import { recalculate } from "@/lib/excel/testing/recalculate";
import { cellAt, type WorkbookModel } from "@/lib/excel/workbook-model";
import { seedElements } from "./elements";
import { examples } from "./examples";
import { seedNodes } from "./nodes";
import type { PersistedModel } from "./persisted-model";
import { atomRestoreModel } from "./persistence";
import { atomResults } from "./results";

/**
 * El libro de `/springs` promete lo mismo que el de `/armaduras-2d`: que el
 * método sigue vivo. Se prueba igual — recalculándolo con HyperFormula, un
 * motor de fórmulas que no es el de la app, antes y después de editar.
 */

function workbook(model: PersistedModel) {
  const store = createStore();
  store.set(atomRestoreModel, model);
  const results = store.get(atomResults);
  if (results.status !== "ok") throw new Error(`el modelo no resuelve: ${results.status}`);
  return buildSpringsWorkbook({ nodes: model.nodes, elements: model.elements, solved: results.solved });
}

const dataRow = (model: WorkbookModel, name: string) => rowNamed(model, SPRINGS_SHEETS.data, name);

const seed: PersistedModel = { nodes: seedNodes(), elements: seedElements(), restrainedFirst: false, useDofNumbers: false };
const cases = [["ejemplo inicial", seed] as const, ...examples.map((e) => [e.name, e.model] as const)].flatMap(
  ([name, model]) => [
    [name, model] as const,
    [`${name}, restringidos arriba`, { ...model, restrainedFirst: !model.restrainedFirst }] as const,
  ],
);

describe("exportación de /springs a Excel", () => {
  it.each(cases)("%s: cada fórmula recalcula a lo mismo que el motor", (_, model) => {
    const book = workbook(model);
    expect(expectSameNumbers(recalculate(book), book)).toBeGreaterThan(15);
  });

  it.each(cases)("%s: editar datos dentro del libro da lo mismo que resolver el modelo editado", (_, model) => {
    const book = workbook(model);
    const recalculated = recalculate(book);

    // Las tres clases de dato vivo: carga, rigidez y desplazamiento prescrito.
    const edited: PersistedModel = structuredClone(model);
    const loose = edited.nodes.find((node) => !node.restrained)!;
    loose.force += 3;
    recalculated.set(SPRINGS_SHEETS.data, dataRow(book, loose.name), 2, loose.force);

    const spring = edited.elements[0];
    spring.k *= 2;
    recalculated.set(SPRINGS_SHEETS.data, dataRow(book, spring.name), 4, spring.k);

    const support = edited.nodes.find((node) => node.restrained)!;
    support.displacement = 0.02;
    recalculated.set(SPRINGS_SHEETS.data, dataRow(book, support.name), 4, support.displacement);

    expectSameNumbers(recalculated, workbook(edited));
  });

  it("no ofrece para editar lo que el cálculo ignoraría, y no trae imagen", () => {
    const book = workbook(seed);
    const data = book.sheets.find((sheet) => sheet.name === SPRINGS_SHEETS.data)!;
    const v4 = dataRow(book, "v4"); // apoyo
    const v1 = dataRow(book, "v1"); // libre

    expect(cellAt(data, v4, 2)?.role).toBe("fixed");
    expect(cellAt(data, v4, 4)?.role).toBe("input");
    expect(cellAt(data, v1, 2)?.role).toBe("input");
    expect(cellAt(data, v1, 4)?.role).toBe("fixed");
    expect(cellAt(data, v4, 3)?.role).toBe("fixed"); // los apoyos se muestran, no se editan
    expect(book.sheets.every((sheet) => sheet.images.length === 0)).toBe(true);
  });
});
