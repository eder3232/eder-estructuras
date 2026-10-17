import type { SolveResult } from "@/lib/engine";
import { SheetBuilder, rangeAddress, type SheetModel } from "./workbook-model";

/**
 * Las dos hojas del libro que **no dependen del tipo de elemento**: el
 * ensamblaje de `K` y la partición con la solución. Nacieron en el libro de
 * `/armaduras-2d` y se sacaron acá al hacer el de `/springs` (2026-10-14).
 *
 * Lo único que necesitan del sistema es dónde está cada dato: en qué celda
 * vive cada término de la rigidez de cada elemento (`stiffnessRef`), dónde la
 * carga de cada grado libre y dónde el desplazamiento prescrito de cada
 * restringido. Con eso escriben las fórmulas que suman y que despejan, igual
 * para una barra de 4×4 que para un resorte de 2×2.
 */
export interface MatrixMethodSheetsInput {
  solved: SolveResult;
  /** Cómo se llama el grado de libertad de la fila/columna `g` de `K`. */
  dofLabel: (g: number) => string;
  /** Los elementos, en el orden del ensamblaje. */
  elementIds: string[];
  /** La celda del término `(i, j)` de la rigidez del elemento, en ejes globales. */
  stiffnessRef: (elementId: string, i: number, j: number) => string;
  /** Dónde está la carga del grado libre `g`, y cuánto vale. */
  force: (g: number) => { ref: string; value: number };
  /** Dónde está el desplazamiento prescrito del grado restringido `g`. */
  prescribedRef: (g: number) => string;
  /** La nota de la hoja Ensamblaje, en el idioma del sistema. */
  assemblyNote: string;
  /**
   * Solo pórticos con cargas en las barras: la celda de la componente `i` del
   * FEM del elemento **en ejes globales**. Con esto la hoja Ensamblaje arma el
   * vector FEM igual que `K`, y la Solución despeja con él:
   * `Uf = Kff⁻¹·(Ff − FEMf − Kfr·Ur)` y `Rr = Krf·Uf + Krr·Ur + FEMr`.
   */
  femRef?: (elementId: string, i: number) => string;
}

export const MATRIX_METHOD_SHEETS = {
  assembly: "Ensamblaje",
  solution: "Solución",
} as const;

export interface MatrixMethodSheets {
  assembly: SheetModel;
  solution: SheetModel;
  /** Dónde quedó cada desplazamiento libre, por grado global. */
  ufRef: Map<number, string>;
  /** Dónde quedó cada reacción, por grado global. */
  rrRef: Map<number, string>;
  /** Dónde quedó cada componente del vector FEM global, si lo hay. */
  femVectorRef: Map<number, string>;
}

export function buildMatrixMethodSheets({
  solved,
  dofLabel,
  elementIds,
  stiffnessRef,
  force,
  prescribedRef,
  assemblyNote,
  femRef,
}: MatrixMethodSheetsInput): MatrixMethodSheets {
  const { dofOrder, partition, globalStiffness, steps } = solved.assembly;
  const stepByElement = new Map(steps.map((step) => [step.elementId, step]));

  // ---------------------------------------------------------------- Ensamblaje
  const assembly = new SheetBuilder(MATRIX_METHOD_SHEETS.assembly);
  const t = globalStiffness.length;
  assembly.text(1, 1, "Matriz de rigidez global K", "title");
  assembly.text(2, 1, assemblyNote, "note");
  assembly.merge(2, 1, 1, Math.max(t + 1, 10));

  // Qué celdas de qué elementos caen en cada (fila, columna) de K: el
  // recorrido del motor (`AssemblyStep.dofs`), escrito como referencias en vez
  // de sumado.
  const contributions: string[][][] = Array.from({ length: t }, () => Array.from({ length: t }, () => []));
  for (const elementId of elementIds) {
    const { dofs } = stepByElement.get(elementId)!;
    dofs.forEach((row, i) => dofs.forEach((col, j) => contributions[row][col].push(stiffnessRef(elementId, i, j))));
  }

  const kTop = 5;
  for (let g = 0; g < t; g++) {
    assembly.text(kTop - 1, 2 + g, `${dofLabel(g)} (${g})`, "header");
    assembly.text(kTop + g, 1, `${dofLabel(g)} (${g})`, "label");
  }
  for (let r = 0; r < t; r++) {
    for (let col = 0; col < t; col++) {
      const refs = contributions[r][col];
      if (refs.length > 0) assembly.formula(kTop + r, 2 + col, refs.join("+"), globalStiffness[r][col]);
      else assembly.set(kTop + r, 2 + col, { role: "computed", value: 0 });
    }
  }
  assembly.width(1, 12);
  for (let col = 2; col <= t + 1; col++) assembly.width(col, 13);

  // El vector FEM, ensamblado con el mismo recorrido que K: una columna más a
  // la derecha, separada por una vacía.
  const femVectorRef = new Map<number, string>();
  const femCol = t + 3;
  if (femRef) {
    const { fixedEndForces } = solved.assembly;
    const femContributions: string[][] = Array.from({ length: t }, () => []);
    for (const elementId of elementIds) {
      stepByElement.get(elementId)!.dofs.forEach((row, i) => femContributions[row].push(femRef(elementId, i)));
    }
    assembly.text(kTop - 1, femCol, "FEM", "header");
    for (let r = 0; r < t; r++) {
      if (femContributions[r].length > 0) assembly.formula(kTop + r, femCol, femContributions[r].join("+"), fixedEndForces[r]);
      else assembly.set(kTop + r, femCol, { role: "computed", value: 0 });
      femVectorRef.set(r, assembly.ref(kTop + r, femCol));
    }
    assembly.width(femCol, 13);
  }

  // ---------------------------------------------------------------- Solución
  const solution = new SheetBuilder(MATRIX_METHOD_SHEETS.solution);
  const { free, restrained } = partition;
  const nf = free.length;
  const nr = restrained.length;
  solution.text(1, 1, "Partición y solución", "title");
  solution.text(
    2,
    1,
    femRef
      ? "K se parte en grados libres (f) y restringidos (r). Con cargas en las barras, F = K·U + FEM: los desplazamientos libres salen de Uf = Kff⁻¹ · (Ff − FEMf − Kfr · Ur) y las reacciones de Rr = Krf · Uf + Krr · Ur + FEMr."
      : "K se parte en grados libres (f) y restringidos (r). Los desplazamientos libres salen de Uf = Kff⁻¹ · (Ff − Kfr · Ur) y las reacciones de Rr = Krf · Uf + Krr · Ur.",
    "note",
  );
  solution.merge(2, 1, 1, Math.max(nf + nr + 3, 10));

  const kRef = (r: number, col: number) => assembly.ref(kTop + r, 2 + col);

  /** Un bloque de K, cada celda una referencia a la hoja Ensamblaje. Devuelve su rango. */
  const block = (title: string, top: number, left: number, rows: number[], cols: number[], values: number[][]) => {
    solution.text(top, left, title, "label");
    cols.forEach((g, j) => solution.text(top + 1, left + 1 + j, dofLabel(g), "header"));
    rows.forEach((g, i) => {
      solution.text(top + 2 + i, left, dofLabel(g), "label");
      cols.forEach((h, j) => solution.formula(top + 2 + i, left + 1 + j, kRef(g, h), values[i][j]));
    });
    return rangeAddress(top + 2, left + 1, rows.length, cols.length);
  };

  const partTop = 4;
  const lowerTop = partTop + nf + 3;
  const rightLeft = 1 + nf + 2;
  const kff = nf > 0 ? block("Kff", partTop, 1, free, free, partition.kff) : null;
  const kfr = nf > 0 ? block("Kfr", partTop, rightLeft, free, restrained, partition.kfr) : null;
  const krf = nf > 0 ? block("Krf", lowerTop, 1, restrained, free, partition.krf) : null;
  const krr = block("Krr", lowerTop, rightLeft, restrained, restrained, partition.krr);

  const valueAt = (map: Map<string, number[]>, g: number) => {
    const entry = dofOrder[g];
    return map.get(entry.nodeId)![entry.localDof];
  };

  /** Un vector columna con sus etiquetas. `cell` escribe cada fila. */
  const vectorTop = lowerTop + nr + 3;
  const vector = (title: string, left: number, dofs: number[], cell: (row: number, col: number, g: number) => void) => {
    solution.text(vectorTop, left, title, "label");
    dofs.forEach((g, i) => {
      solution.text(vectorTop + 1 + i, left, dofLabel(g), "label");
      cell(vectorTop + 1 + i, left + 1, g);
    });
    return rangeAddress(vectorTop + 1, left + 1, dofs.length, 1);
  };

  const ffLeft = 1;
  const urLeft = 4;
  const ufLeft = femRef ? 10 : 7;
  const rrLeft = femRef ? 13 : 10;
  const ff = vector("Ff (cargas)", ffLeft, free, (row, col, g) => {
    const { ref, value } = force(g);
    solution.formula(row, col, ref, value);
  });
  const ur = vector("Ur (desplaz. prescritos)", urLeft, restrained, (row, col, g) => {
    solution.formula(row, col, prescribedRef(g), valueAt(solved.displacements, g));
  });

  // Con FEM, sus dos mitades van entre los datos y las incógnitas.
  const femFLeft = 7;
  const femFRange =
    femRef && nf > 0
      ? (() => {
          solution.text(vectorTop, femFLeft, "FEMf", "label");
          free.forEach((g, i) => {
            solution.text(vectorTop + 1 + i, femFLeft, dofLabel(g), "label");
            solution.formula(vectorTop + 1 + i, femFLeft + 1, femVectorRef.get(g)!, solved.assembly.fixedEndForces[g]);
          });
          return rangeAddress(vectorTop + 1, femFLeft + 1, nf, 1);
        })()
      : null;
  const femRLeft = femFLeft;
  const femRTop = vectorTop + nf + 2;
  const femRRange = femRef
    ? (() => {
        solution.text(femRTop, femRLeft, "FEMr", "label");
        restrained.forEach((g, i) => {
          solution.text(femRTop + 1 + i, femRLeft, dofLabel(g), "label");
          solution.formula(femRTop + 1 + i, femRLeft + 1, femVectorRef.get(g)!, solved.assembly.fixedEndForces[g]);
        });
        return rangeAddress(femRTop + 1, femRLeft + 1, nr, 1);
      })()
    : null;

  const ufRef = new Map<number, string>();
  const rrRef = new Map<number, string>();

  let uf: string | null = null;
  if (nf > 0) {
    solution.text(vectorTop, ufLeft, "Uf (desplazamientos)", "label");
    free.forEach((g, i) => {
      solution.text(vectorTop + 1 + i, ufLeft, dofLabel(g), "label");
      ufRef.set(g, solution.ref(vectorTop + 1 + i, ufLeft + 1));
    });
    uf = rangeAddress(vectorTop + 1, ufLeft + 1, nf, 1);
    const loads = femFRange ? `${ff}-${femFRange}` : ff;
    const rhs = nr > 0 ? `${loads}-MMULT(${kfr},${ur})` : loads;
    solution.array(
      vectorTop + 1,
      ufLeft + 1,
      `MMULT(MINVERSE(${kff}),${rhs})`,
      free.map((g) => [valueAt(solved.displacements, g)]),
    );
  }

  solution.text(vectorTop, rrLeft, "Rr (reacciones)", "label");
  restrained.forEach((g, i) => {
    solution.text(vectorTop + 1 + i, rrLeft, dofLabel(g), "label");
    rrRef.set(g, solution.ref(vectorTop + 1 + i, rrLeft + 1));
  });
  solution.array(
    vectorTop + 1,
    rrLeft + 1,
    (uf ? `MMULT(${krf},${uf})+MMULT(${krr},${ur})` : `MMULT(${krr},${ur})`) + (femRRange ? `+${femRRange}` : ""),
    restrained.map((g) => [valueAt(solved.reactions, g)]),
  );
  for (let col = 1; col <= Math.max(rightLeft + nr, rrLeft + 1); col++) solution.width(col, 13);

  return { assembly: assembly.sheet, solution: solution.sheet, ufRef, rrRef, femVectorRef };
}
