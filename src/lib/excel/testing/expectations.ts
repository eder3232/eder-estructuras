import { expect } from "vitest";

import { eachCell, type WorkbookModel } from "../workbook-model";
import type { Recalculated } from "./recalculate";

/**
 * Lo que comparten los tests de los libros de Excel de cada sistema: recorrer
 * todo lo que el libro calcula y exigir que el libro recalculado dé lo mismo.
 * Solo para tests.
 */

/** Cada número que el libro calcula, con dónde está y cuánto tiene que dar. */
export function* expectations(model: WorkbookModel) {
  for (const sheet of model.sheets) {
    for (const [row, col, cell] of eachCell(sheet)) {
      if (cell.formula !== undefined) yield { sheet: sheet.name, row, col, expected: cell.result! };
    }
    for (const array of sheet.arrays) {
      for (let r = 0; r < array.rows; r++) {
        for (let c = 0; c < array.cols; c++) {
          yield { sheet: sheet.name, row: array.row + r, col: array.col + c, expected: array.results[r][c] };
        }
      }
    }
  }
}

/**
 * Tolerancia relativa a la escala de la hoja: en `K` conviven números grandes
 * con ceros que el redondeo deja en 10⁻⁹, y una relativa pura fallaría en esos
 * ceros. Devuelve cuántas celdas comparó, para que un test pueda exigir que
 * no fueron cero.
 */
export function expectSameNumbers(book: Recalculated, expected: WorkbookModel): number {
  const scale = new Map<string, number>();
  for (const e of expectations(expected)) scale.set(e.sheet, Math.max(scale.get(e.sheet) ?? 0, Math.abs(e.expected)));

  let checked = 0;
  for (const { sheet, row, col, expected: want } of expectations(expected)) {
    const got = book.value(sheet, row, col);
    const where = `${sheet}!R${row}C${col}`;
    expect(typeof got, `${where} dio ${JSON.stringify(got)}`).toBe("number");
    const tolerance = 1e-9 * Math.abs(want) + 1e-12 * scale.get(sheet)!;
    expect(Math.abs((got as number) - want), `${where}: ${got} contra ${want}`).toBeLessThanOrEqual(tolerance);
    checked++;
  }
  return checked;
}

/** La fila de una hoja donde está una fila del modelo, buscándola por nombre en la primera columna. */
export function rowNamed(model: WorkbookModel, sheetName: string, name: string): number {
  const sheet = model.sheets.find((s) => s.name === sheetName)!;
  for (const [row, col, cell] of eachCell(sheet)) if (col === 1 && cell.value === name) return row;
  throw new Error(`no está ${name} en ${sheetName}`);
}
