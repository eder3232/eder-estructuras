/**
 * Un libro de Excel descrito como datos, sin ninguna librería.
 *
 * **Existe para que lo que se verifica sea lo mismo que se escribe.** El
 * generador arma este modelo; `write-xlsx.ts` lo vuelca con `exceljs` y el test
 * lo recalcula con un motor de fórmulas independiente. Si las fórmulas se
 * escribieran directo sobre `exceljs`, el test tendría que leer el `.xlsx` de
 * vuelta para recalcularlo — y si algún día `exceljs` hay que cambiarlo (está
 * casi sin mantenimiento), se cambia solo el escritor.
 *
 * Filas y columnas empiezan en 1, como en Excel.
 */

/**
 * Qué es la celda para quien abre el libro, que es lo que decide cómo se ve.
 * `input` es lo único que el alumno debería tocar.
 */
export type CellRole = "title" | "subtitle" | "note" | "header" | "label" | "input" | "fixed" | "computed";

export interface ModelCell {
  role: CellRole;
  /** Valor literal. Excluyente con `formula`. */
  value?: number | string;
  /** Fórmula **sin** el `=` inicial, con las funciones en inglés (Excel las traduce al abrir). */
  formula?: string;
  /** Lo que da la fórmula según el motor, para que el libro se vea bien aunque no se recalcule. */
  result?: number;
}

/** Una fórmula matricial clásica (`{=...}`): una sola fórmula para todo un bloque. */
export interface ArrayFormula {
  row: number;
  col: number;
  rows: number;
  cols: number;
  formula: string;
  /** Resultado del motor, `rows × cols`. */
  results: number[][];
}

export interface Merge {
  row: number;
  col: number;
  rows: number;
  cols: number;
}

export interface SheetImage {
  row: number;
  col: number;
  /** PNG en base64, **sin** el prefijo `data:`. */
  base64: string;
  width: number;
  height: number;
}

export interface SheetModel {
  name: string;
  cells: Map<string, ModelCell>;
  arrays: ArrayFormula[];
  merges: Merge[];
  /** Ancho por columna, en caracteres. Las que no figuran quedan con el de Excel. */
  widths: Map<number, number>;
  images: SheetImage[];
}

export interface WorkbookModel {
  sheets: SheetModel[];
}

const key = (row: number, col: number) => `${row},${col}`;

/** `1 → A`, `27 → AA`. */
export function columnLetter(col: number): string {
  let letters = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

/** Dirección relativa (`B3`): las fórmulas no se copian, así que no hacen falta `$`. */
export function address(row: number, col: number): string {
  return `${columnLetter(col)}${row}`;
}

export function rangeAddress(row: number, col: number, rows: number, cols: number): string {
  return `${address(row, col)}:${address(row + rows - 1, col + cols - 1)}`;
}

/**
 * Referencia a otra hoja. **Siempre entre comillas**: los nombres llevan tildes
 * (`Solución`) y con comillas no hay que decidir cuándo hacen falta.
 */
export function sheetRef(sheet: string, ref: string): string {
  return `'${sheet}'!${ref}`;
}

/** Arma una hoja celda por celda. Solo junta datos: no sabe nada de estructuras. */
export class SheetBuilder {
  readonly sheet: SheetModel;

  constructor(name: string) {
    this.sheet = { name, cells: new Map(), arrays: [], merges: [], widths: new Map(), images: [] };
  }

  get name() {
    return this.sheet.name;
  }

  set(row: number, col: number, cell: ModelCell): void {
    this.sheet.cells.set(key(row, col), cell);
  }

  text(row: number, col: number, value: string, role: CellRole = "label"): void {
    this.set(row, col, { role, value });
  }

  formula(row: number, col: number, formula: string, result: number): void {
    this.set(row, col, { role: "computed", formula, result });
  }

  /** Una matriz entera calculada con una sola fórmula matricial. */
  array(row: number, col: number, formula: string, results: number[][]): void {
    this.sheet.arrays.push({ row, col, rows: results.length, cols: results[0].length, formula, results });
  }

  merge(row: number, col: number, rows: number, cols: number): void {
    this.sheet.merges.push({ row, col, rows, cols });
  }

  width(col: number, chars: number): void {
    this.sheet.widths.set(col, chars);
  }

  image(image: SheetImage): void {
    this.sheet.images.push(image);
  }

  /** Para cuando una referencia a esta hoja la arma otra. */
  ref(row: number, col: number): string {
    return sheetRef(this.name, address(row, col));
  }

  rangeRef(row: number, col: number, rows: number, cols: number): string {
    return sheetRef(this.name, rangeAddress(row, col, rows, cols));
  }
}

export function cellAt(sheet: SheetModel, row: number, col: number): ModelCell | undefined {
  return sheet.cells.get(key(row, col));
}

/** Recorre las celdas sueltas con su posición (las matriciales van aparte, en `arrays`). */
export function* eachCell(sheet: SheetModel): Generator<[number, number, ModelCell]> {
  for (const [k, cell] of sheet.cells) {
    const [row, col] = k.split(",").map(Number);
    yield [row, col, cell];
  }
}
