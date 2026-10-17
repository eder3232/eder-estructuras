import { describe, expect, it } from "vitest";

import { SEISMIC_SHEETS, buildSeismicWorkbook } from "@/lib/excel/frame-2d-seismic-workbook";
import { expectSameNumbers, rowNamed } from "@/lib/excel/testing/expectations";
import { recalculate } from "@/lib/excel/testing/recalculate";
import { cellAt, eachCell, type WorkbookModel } from "@/lib/excel/workbook-model";
import { atomLateralAnalysis } from "./analysis";
import { atomSeismicWorkbookInput } from "./excel";
import { seismicExamples } from "./examples";
import { createSeismicStore, seedSeismicModel, type PersistedSeismicModel } from "./persistence";

/**
 * El libro de `frame2d-seismic` (paso 8 de `docs/frame2d-seismic-v1.md`): lo
 * que promete vivo —el sismo, la rigidez lateral con sus derivas, las
 * combinaciones— se prueba como en los otros sistemas: recalculado con
 * HyperFormula, que no es el motor de la app, antes y después de editar.
 */
function workbookOf(model: PersistedSeismicModel): WorkbookModel {
  const input = createSeismicStore(model).get(atomSeismicWorkbookInput);
  if (!input) throw new Error("el modelo no da un libro");
  return buildSeismicWorkbook(input);
}

const seed = seedSeismicModel();
const models: [string, PersistedSeismicModel][] = [
  ["ejemplo inicial", seed],
  ...seismicExamples.map((e): [string, PersistedSeismicModel] => [e.name, e.model]),
  ["período escrito", { ...seed, params: { ...seed.params, periodMode: "manual", T: 0.8 } }],
  ["restringidos arriba", { ...seed, restrainedFirst: true }],
];

/** Solo las hojas que el libro mantiene vivas ante una edición: las fuerzas de cada caso son fijas. */
const only = (model: WorkbookModel, names: string[]): WorkbookModel => ({
  sheets: model.sheets.filter((s) => names.includes(s.name)),
});

/** La fila de un parámetro de la hoja Sismo, por su rótulo. */
function paramRow(model: WorkbookModel, label: string): number {
  const sheet = model.sheets.find((s) => s.name === SEISMIC_SHEETS.seismic)!;
  for (const [row, col, cell] of eachCell(sheet)) if (col === 1 && cell.value === label) return row;
  throw new Error(`no está ${label}`);
}

describe("exportación de frame2d-seismic a Excel", () => {
  it.each(models)("%s: cada fórmula recalcula a lo mismo que el motor", (_, model) => {
    const book = workbookOf(model);
    expect(expectSameNumbers(recalculate(book), book)).toBeGreaterThan(40);
  });

  it.each(models)("%s: K_L y δ del libro son los de la app", (_, model) => {
    const book = workbookOf(model);
    const lateral = createSeismicStore(model).get(atomLateralAnalysis);
    if (lateral.status !== "ok") throw new Error(lateral.status);
    const sheet = book.sheets.find((s) => s.name === SEISMIC_SHEETS.lateral)!;
    const [kl, delta] = sheet.arrays.filter((a) => a.cols === lateral.levels.length || a.cols === 1);
    kl.results.forEach((r, i) => r.forEach((v, j) => expect(v).toBeCloseTo(lateral.condensation.condensed[i][j], 6)));
    delta.results.forEach(([v], i) => expect(v).toBeCloseTo(lateral.displacements[i], 12));
  });

  it("editar el sismo dentro del libro da lo mismo que la app con el modelo editado", () => {
    const book = workbookOf(seed);
    const recalculated = recalculate(book);
    const edited: PersistedSeismicModel = structuredClone(seed);

    edited.params.Z = 0.35;
    recalculated.set(SEISMIC_SHEETS.seismic, paramRow(book, "Z"), 2, 0.35);
    edited.levels.weights[0] = 42;
    recalculated.set(SEISMIC_SHEETS.seismic, rowNamed(book, SEISMIC_SHEETS.seismic, "Nivel 1"), 4, 42);
    edited.params.R0 = 6;
    recalculated.set(SEISMIC_SHEETS.seismic, paramRow(book, "R0"), 2, 6);

    expect(
      expectSameNumbers(recalculated, only(workbookOf(edited), [SEISMIC_SHEETS.seismic, SEISMIC_SHEETS.lateral])),
    ).toBeGreaterThan(30);
  });

  it("si el mínimo de C/R pasa a mandar en el libro, las derivas usan el V sin él, como en la app", () => {
    const book = workbookOf(seed);
    const recalculated = recalculate(book);
    const edited: PersistedSeismicModel = structuredClone(seed);
    // R0 = 30: C/R = 2.5/30 = 0.083 < 0.11.
    edited.params.R0 = 30;
    recalculated.set(SEISMIC_SHEETS.seismic, paramRow(book, "R0"), 2, 30);
    expectSameNumbers(recalculated, only(workbookOf(edited), [SEISMIC_SHEETS.seismic, SEISMIC_SHEETS.lateral]));
  });

  it("editar un factor de combinación cambia esa combinación y la envolvente, como en la app", () => {
    const book = workbookOf(seed);
    const recalculated = recalculate(book);
    const edited: PersistedSeismicModel = structuredClone(seed);
    edited.combinations[0].factors.CM = 1.2;
    edited.combinations[0].factors.CV = 1.6;
    const row = rowNamed(book, SEISMIC_SHEETS.combinations, edited.combinations[0].name);
    recalculated.set(SEISMIC_SHEETS.combinations, row, 2, 1.2);
    recalculated.set(SEISMIC_SHEETS.combinations, row, 3, 1.6);
    expect(expectSameNumbers(recalculated, workbookOf(edited))).toBeGreaterThan(100);
  });

  it("con las fuerzas escritas, las Fᵢ son las editables y no hay parámetros del suelo", () => {
    const book = workbookOf(seismicExamples.find((e) => e.id === "articulado")!.model);
    const sheet = book.sheets.find((s) => s.name === SEISMIC_SHEETS.seismic)!;
    const level = rowNamed(book, SEISMIC_SHEETS.seismic, "Nivel 1");
    expect(cellAt(sheet, level, 7)?.role).toBe("input");
    expect(() => paramRow(book, "Z")).toThrow();
  });
});
