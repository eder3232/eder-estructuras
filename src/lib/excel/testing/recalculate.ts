import {
  ArraySize,
  FunctionArgumentType,
  FunctionPlugin,
  HyperFormula,
  SimpleRangeValue,
} from "hyperformula";
import { inv } from "mathjs";

import { eachCell, type WorkbookModel } from "../workbook-model";

/**
 * Recalcula un `WorkbookModel` con HyperFormula, un motor de fórmulas
 * compatible con Excel e **independiente del motor de la app**: es lo que hace
 * que el test pruebe algo. Comparar las fórmulas contra el `result` que les
 * puso el propio generador sería circular.
 *
 * Solo para tests: HyperFormula es GPL-3 y va como dependencia de desarrollo,
 * no viaja en la app.
 *
 * HyperFormula no trae `MINVERSE`, así que se registra acá. Invertir no es lo
 * que se está probando —es `mathjs`, igual que en el motor—; lo que se prueba es
 * **el cableado**: que cada referencia apunte a la celda que tiene que apuntar.
 * La verificación contra Excel de verdad se hace aparte, por COM (ver
 * `docs/excel-export.md`).
 */
class MinversePlugin extends FunctionPlugin {
  static implementedFunctions = {
    MINVERSE: {
      method: "minverse",
      sizeOfResultArrayMethod: "minverseSize",
      parameters: [{ argumentType: FunctionArgumentType.RANGE }],
      vectorizationForbidden: true,
    },
  };

  // HyperFormula no exporta los tipos de su árbol de sintaxis: se toman de la
  // firma de `runFunction`, que es a quien se le pasan.
  minverse(ast: { args: Parameters<MinversePlugin["runFunction"]>[0] }, state: Parameters<MinversePlugin["runFunction"]>[1]) {
    return this.runFunction(ast.args, state, this.metadata("MINVERSE"), (matrix: SimpleRangeValue) => {
      // `rawNumbers()` sale vacío hasta que algo fuerza la conversión: es lo
      // que hace el propio `MMULT` de HyperFormula antes de leerlo.
      matrix.hasOnlyNumbers();
      return SimpleRangeValue.onlyNumbers(inv(matrix.rawNumbers()) as number[][]);
    });
  }

  minverseSize(ast: { args: Parameters<MinversePlugin["runFunction"]>[0] }, state: Parameters<MinversePlugin["runFunction"]>[1]) {
    const size = this.arraySizeForAst(ast.args[0], state);
    return new ArraySize(size.width, size.height);
  }
}

let registered = false;

export interface Recalculated {
  /** Valor recalculado de una celda (fila y columna desde 1, como en Excel). */
  value: (sheet: string, row: number, col: number) => unknown;
  /** Edita una celda de entrada, como lo haría el alumno en Excel. */
  set: (sheet: string, row: number, col: number, value: number) => void;
}

export function recalculate(model: WorkbookModel): Recalculated {
  if (!registered) {
    HyperFormula.registerFunctionPlugin(MinversePlugin, { enGB: { MINVERSE: "MINVERSE" } });
    registered = true;
  }

  const sheets: Record<string, (string | number | null)[][]> = {};
  for (const sheet of model.sheets) {
    const grid: (string | number | null)[][] = [];
    const put = (row: number, col: number, value: string | number | null) => {
      while (grid.length < row) grid.push([]);
      const line = grid[row - 1];
      while (line.length < col) line.push(null);
      line[col - 1] = value;
    };
    for (const [row, col, cell] of eachCell(sheet)) {
      put(row, col, cell.formula !== undefined ? `=${cell.formula}` : (cell.value ?? null));
    }
    // Excel guarda la fórmula matricial en todo el bloque; HyperFormula la
    // escribe en la esquina y la derrama. Las demás celdas tienen que quedar
    // vacías, si no el derrame choca.
    for (const array of sheet.arrays) put(array.row, array.col, `=${array.formula}`);
    sheets[sheet.name] = grid;
  }

  const hf = HyperFormula.buildFromSheets(sheets, {
    licenseKey: "gpl-v3",
    useArrayArithmetic: true,
    // Sin redondeo de presentación: se comparan números, no lo que mostraría.
    smartRounding: false,
  });

  const id = (sheet: string) => {
    const sheetId = hf.getSheetId(sheet);
    if (sheetId === undefined) throw new Error(`No existe la hoja ${sheet}`);
    return sheetId;
  };

  return {
    value: (sheet, row, col) => hf.getCellValue({ sheet: id(sheet), row: row - 1, col: col - 1 }),
    set: (sheet, row, col, value) => {
      hf.setCellContents({ sheet: id(sheet), row: row - 1, col: col - 1 }, value);
    },
  };
}
