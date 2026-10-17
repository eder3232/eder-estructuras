import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { buildFrame2DWorkbook, FRAME_2D_SHEETS } from "@/lib/excel/frame-2d-workbook";
import { expectSameNumbers, rowNamed } from "@/lib/excel/testing/expectations";
import { recalculate } from "@/lib/excel/testing/recalculate";
import { cellAt, type WorkbookModel } from "@/lib/excel/workbook-model";
import { seedElements } from "./elements";
import { examples } from "./examples";
import type { LoadRow } from "./loads";
import { seedNodes } from "./nodes";
import type { PersistedModel } from "./persisted-model";
import { atomRestoreModel } from "./persistence";
import { atomResults } from "./results";

/**
 * El libro de `/frame2d` promete lo mismo que los de los otros sistemas —que
 * el método sigue vivo— más lo propio: **el FEM de cada carga es una fórmula**
 * de sus valores, sus posiciones y la geometría. Se prueba igual: recalculado
 * con HyperFormula, un motor de fórmulas que no es el de la app, antes y
 * después de editar.
 */

function workbook(model: PersistedModel) {
  const store = createStore();
  store.set(atomRestoreModel, model);
  const results = store.get(atomResults);
  if (results.status !== "ok") throw new Error(`el modelo no resuelve: ${results.status}`);
  return buildFrame2DWorkbook({
    nodes: model.nodes,
    elements: model.elements,
    loads: model.loads,
    solved: results.solved,
  });
}

const row = (model: WorkbookModel, sheet: string, name: string) => rowNamed(model, sheet, name);

// Columnas (ver `frame-2d-workbook.ts`).
const DATA = { x: 2, forceX: 4, prescribedZ: 11, inertia: 5 } as const;
const LOADS = { q1: 5, a: 7 } as const;

const seed: PersistedModel = {
  nodes: seedNodes(),
  elements: seedElements(),
  loads: [],
  restrainedFirst: false,
  useDofNumbers: false,
};

const load = (fields: Partial<LoadRow> & Pick<LoadRow, "id" | "name" | "elementId">): LoadRow => ({
  kind: "distributed",
  direction: "globalZ",
  q1: 0,
  q2: 0,
  wholeBar: true,
  a: 0,
  b: 0,
  projected: false,
  ...fields,
});

/**
 * Todas las clases de carga juntas sobre el pórtico a dos aguas: trapezoidal
 * parcial, puntual inclinada, momento concentrado, axial y por planta. Es lo
 * que ninguna tabla de libro cubre, y lo que el libro tiene que integrar bien.
 */
const dosAguas = examples.find((e) => e.id === "dos-aguas")!.model;
const mixed: PersistedModel = {
  ...dosAguas,
  loads: [
    ...dosAguas.loads,
    load({ id: "m1", name: "m1", elementId: "da-e1", direction: "globalX", q1: 2, q2: 5, wholeBar: false, a: 0.5, b: 3 }),
    load({ id: "m2", name: "m2", elementId: "da-e2", kind: "point", direction: "perpendicular", q1: -4, a: 2 }),
    load({ id: "m3", name: "m3", elementId: "da-e3", kind: "moment", q1: 6, a: 1.5 }),
    load({ id: "m4", name: "m4", elementId: "da-e4", direction: "axial", q1: -1, q2: -1, wholeBar: false, a: 1, b: 3.5 }),
  ],
};

/** Una barra con el FEM escrito a mano: sus cargas no cuentan, y lo escrito sí. */
const manual: PersistedModel = {
  ...seed,
  elements: seed.elements.map((e) =>
    e.id === "seed-e2"
      ? { ...e, manualFem: true, femShearFrom: 25, femMomentFrom: 250 / 12, femShearTo: 25, femMomentTo: -250 / 12 }
      : e,
  ),
  loads: [load({ id: "ignored", name: "ignorada", elementId: "seed-e2", q1: -99, q2: -99 })],
};

const models: [string, PersistedModel][] = [
  ["ejemplo inicial", seed],
  ...examples.map((e): [string, PersistedModel] => [e.name, e.model]),
  ["todas las cargas", mixed],
  ["FEM a mano", manual],
];
const cases = models.flatMap(([name, model]) => [
  [name, model] as const,
  [`${name}, restringidos arriba`, { ...model, restrainedFirst: !model.restrainedFirst }] as const,
]);

describe("exportación de /frame2d a Excel", () => {
  it.each(cases)("%s: cada fórmula recalcula a lo mismo que el motor", (_, model) => {
    const book = workbook(model);
    expect(expectSameNumbers(recalculate(book), book)).toBeGreaterThan(100);
  });

  it.each(cases)("%s: editar datos dentro del libro da lo mismo que resolver el modelo editado", (_, model) => {
    const book = workbook(model);
    const recalculated = recalculate(book);
    const edited: PersistedModel = structuredClone(model);

    // Geometría: mover un nudo libre en X cambia L, c y s de sus barras, y con
    // ellos K y el FEM. (En la viga continua ningún nudo es libre en Z.)
    const loose = edited.nodes.find((n) => !n.restrainedX)!;
    loose.x += 0.3;
    recalculated.set(FRAME_2D_SHEETS.data, row(book, FRAME_2D_SHEETS.data, loose.name), DATA.x, loose.x);

    loose.forceX += 2;
    recalculated.set(FRAME_2D_SHEETS.data, row(book, FRAME_2D_SHEETS.data, loose.name), DATA.forceX, loose.forceX);

    const bar = edited.elements[0];
    bar.inertia *= 2;
    recalculated.set(FRAME_2D_SHEETS.data, row(book, FRAME_2D_SHEETS.data, bar.name), DATA.inertia, bar.inertia);

    const support = edited.nodes.find((n) => n.restrainedZ)!;
    support.displacementZ = -0.002;
    recalculated.set(
      FRAME_2D_SHEETS.data,
      row(book, FRAME_2D_SHEETS.data, support.name),
      DATA.prescribedZ,
      support.displacementZ,
    );

    // Las cargas en las barras: su valor y, si tiene, su posición.
    const usable = edited.loads.filter((l) => !edited.elements.find((e) => e.id === l.elementId)?.manualFem);
    if (usable.length > 0) {
      const first = usable[0];
      first.q1 *= 1.5;
      recalculated.set(FRAME_2D_SHEETS.loads, row(book, FRAME_2D_SHEETS.loads, first.name), LOADS.q1, first.q1);
      const positioned = usable.find((l) => l.kind !== "distributed" || !l.wholeBar);
      if (positioned) {
        positioned.a += 0.25;
        recalculated.set(FRAME_2D_SHEETS.loads, row(book, FRAME_2D_SHEETS.loads, positioned.name), LOADS.a, positioned.a);
      }
    }

    expectSameNumbers(recalculated, workbook(edited));
  });

  it("solo ofrece para editar lo que cuenta: el FEM a mano en su barra, las cargas de las barras que no lo tienen", () => {
    const book = workbook(manual);
    const data = book.sheets.find((s) => s.name === FRAME_2D_SHEETS.data)!;
    const e1 = row(book, FRAME_2D_SHEETS.data, "e1");
    const e2 = row(book, FRAME_2D_SHEETS.data, "e2");
    expect(cellAt(data, e2, 9)?.role).toBe("input"); // FEM V desde, a mano
    expect(cellAt(data, e1, 9)?.role).toBe("fixed");
    // La carga de la barra con FEM a mano no aparece: no cuenta.
    const loads = book.sheets.find((s) => s.name === FRAME_2D_SHEETS.loads)!;
    expect([...loads.cells.values()].some((cell) => cell.value === "ignorada")).toBe(false);
  });
});
