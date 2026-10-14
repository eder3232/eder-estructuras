import type { Cell, CellFormulaValue, Style } from "exceljs";

import { eachCell, rangeAddress, type CellRole, type WorkbookModel } from "./workbook-model";

/**
 * Vuelca un `WorkbookModel` a un `.xlsx` con `exceljs`.
 *
 * **`exceljs` se carga recién acá, con `import()`**: pesa ~250 KB comprimido y
 * solo lo necesita quien aprieta el botón de exportar, así que la página no lo
 * paga al abrir.
 *
 * Es el único archivo que conoce a `exceljs`. La librería está casi sin
 * mantenimiento (4.4.0 es la última); si algún día falla, se cambia esto y nada
 * más — el generador y su test no la ven.
 *
 * Lo que se verificó contra Excel de verdad (por COM, 2026-10-14): que las
 * fórmulas matriciales se escriben como `<f t="array">` y Excel las reconoce
 * (`{=MMULT(MINVERSA(...))}`), que recalcula al editar, y que las funciones van
 * en inglés en el archivo y Excel las muestra traducidas.
 */

const BORDER = { style: "thin" as const, color: { argb: "FFBFBFBF" } };

const STYLE: Record<CellRole, Partial<Style>> = {
  title: { font: { bold: true, size: 14 } },
  subtitle: { font: { bold: true, size: 12 } },
  note: {
    font: { italic: true, color: { argb: "FF595959" } },
    alignment: { wrapText: true, vertical: "top" },
  },
  header: {
    font: { bold: true },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: { bottom: BORDER },
  },
  label: { font: { bold: true, color: { argb: "FF404040" } } },
  // Lo único que el alumno debería tocar, y tiene que verse de lejos.
  input: {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } },
    border: { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER },
  },
  fixed: { font: { color: { argb: "FF7F7F7F" } }, alignment: { horizontal: "center" } },
  computed: {},
};

function applyStyle(cell: Cell, role: CellRole) {
  Object.assign(cell, STYLE[role]);
}

export async function writeXlsx(model: WorkbookModel): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eder Estructuras";
  workbook.created = new Date();
  // Los resultados del motor ya van guardados, pero si el alumno abre una
  // copia vieja o Excel decide no confiar en ellos, que recalcule igual.
  workbook.calcProperties.fullCalcOnLoad = true;

  for (const sheet of model.sheets) {
    // **La vista explícita no es decorativa.** Sin `views`, `exceljs` no
    // escribe `<sheetViews>` y Excel abre **todas** las filas a 2/3 del alto
    // pedido: una nota de dos renglones pedida a 30 pt salía a 20 y cortaba el
    // segundo. Se aisló por trasplante de XML contra un archivo guardado por
    // Excel: agregar solo ese bloque lo arregla (2026-10-14).
    const ws = workbook.addWorksheet(sheet.name, { views: [{ state: "normal" }] });
    // El `dyDescent="55"` que pone por defecto no era la causa, pero tampoco es
    // un valor que escriba Excel (escribe 0.25 o 0.35).
    ws.properties.dyDescent = 0.25;

    for (const [col, width] of sheet.widths) ws.getColumn(col).width = width;

    for (const [row, col, modelCell] of eachCell(sheet)) {
      const cell = ws.getCell(row, col);
      cell.value =
        modelCell.formula !== undefined
          ? { formula: modelCell.formula, result: modelCell.result }
          : (modelCell.value ?? null);
      applyStyle(cell, modelCell.role);
    }

    for (const array of sheet.arrays) {
      const ref = rangeAddress(array.row, array.col, array.rows, array.cols);
      for (let r = 0; r < array.rows; r++) {
        for (let c = 0; c < array.cols; c++) {
          const cell = ws.getCell(array.row + r, array.col + c);
          // La fórmula va solo en la esquina; el resto del bloque lleva el
          // valor, que es como Excel guarda una fórmula matricial clásica.
          cell.value =
            r === 0 && c === 0
              ? // Los tipos de `exceljs` no declaran `shareType`/`ref`, pero la
                // librería los escribe: es su API documentada de fórmulas matriciales.
                ({ formula: array.formula, result: array.results[0][0], shareType: "array", ref } as CellFormulaValue)
              : array.results[r][c];
          applyStyle(cell, "computed");
        }
      }
    }

    for (const merge of sheet.merges) {
      ws.mergeCells(merge.row, merge.col, merge.row + merge.rows - 1, merge.col + merge.cols - 1);
      // Una nota larga en una celda combinada no agranda la fila sola: Excel no
      // ajusta el alto de las combinadas. Se estima por largo de texto.
      const text = ws.getCell(merge.row, merge.col).value;
      if (typeof text === "string") {
        let chars = 0;
        for (let col = merge.col; col < merge.col + merge.cols; col++) chars += ws.getColumn(col).width ?? 9;
        ws.getRow(merge.row).height = 15 * Math.max(1, Math.ceil((text.length * 0.9) / chars));
      }
    }

    for (const image of sheet.images) {
      const id = workbook.addImage({ base64: image.base64, extension: "png" });
      ws.addImage(id, {
        tl: { col: image.col - 1, row: image.row - 1 },
        ext: { width: image.width, height: image.height },
      });
    }
  }

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}
