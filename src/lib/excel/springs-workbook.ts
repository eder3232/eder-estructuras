import type { SolveResult, SpringInternalForce } from "@/lib/engine";
import { buildMatrixMethodSheets, MATRIX_METHOD_SHEETS } from "./matrix-method-sheets";
import { SheetBuilder, type WorkbookModel } from "./workbook-model";

/**
 * El libro de Excel de un sistema de resortes, **con el método vivo**: las
 * cargas, los desplazamientos prescritos y la rigidez `k` de cada resorte son
 * celdas, y todo lo demás —la matriz de cada resorte, `K`, la partición, la
 * solución y la fuerza en cada resorte— son fórmulas. Sin macros.
 *
 * Es el mismo libro que el de `/armaduras-2d` sin la geometría: no hay
 * coordenadas ni transformación, así que la hoja de cada elemento es solo
 * `k·[[1, −1], [−1, 1]]`. Las hojas Ensamblaje y Solución son las mismas
 * (`matrix-method-sheets.ts`).
 *
 * **Sin imagen**, a propósito: un sistema de resortes no tiene geometría, y
 * cualquier dibujo a escala inventaría longitudes y posiciones. La tabla
 * Desde/Hacia ya dice todo lo que hay (decisión del 2026-10-14, ver
 * `docs/springs-v1.md`).
 *
 * Los apoyos y la conectividad quedan fijos, con la misma nota que el de
 * armaduras: deciden dónde cae cada número en `K` y cómo se parte.
 */

export interface SpringNodeInput {
  id: string;
  name: string;
  force: number;
  displacement: number;
  restrained: boolean;
}

export interface SpringElementInput {
  id: string;
  name: string;
  fromNodeId: string;
  toNodeId: string;
  k: number;
}

export interface SpringsWorkbookInput {
  nodes: SpringNodeInput[];
  elements: SpringElementInput[];
  /** Tiene que ser la solución de **estos** nudos y resortes. */
  solved: SolveResult;
}

export const SPRINGS_SHEETS = {
  data: "Datos",
  springs: "Resortes",
  assembly: MATRIX_METHOD_SHEETS.assembly,
  solution: MATRIX_METHOD_SHEETS.solution,
  results: "Resultados",
} as const;

const NOT_APPLICABLE = "—";

export function buildSpringsWorkbook({ nodes, elements, solved }: SpringsWorkbookInput): WorkbookModel {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const { dofOrder, steps } = solved.assembly;
  const stepByElement = new Map(steps.map((step) => [step.elementId, step]));
  // Un grado de libertad por nudo: el rótulo es el nombre del nudo.
  const dofLabel = (g: number) => nodesById.get(dofOrder[g].nodeId)!.name;
  const globalIndexOf = new Map(dofOrder.map((entry) => [entry.nodeId, entry.globalIndex]));

  // ---------------------------------------------------------------- Datos
  const data = new SheetBuilder(SPRINGS_SHEETS.data);
  data.text(1, 1, "Sistema de resortes — método matricial de rigideces", "title");
  const notes = [
    "Las celdas amarillas se pueden editar: cargas, desplazamientos prescritos y la rigidez k de cada resorte. Todo lo demás son fórmulas y se recalcula solo. La k tiene que ser positiva: la app la rechaza, pero el libro no puede impedirlo.",
    "Los apoyos y las conexiones entre resortes NO se editan en este libro: deciden cómo se arma y cómo se parte la matriz global. Para cambiarlos, volvé a Eder Estructuras y generá otro Excel.",
    "El libro no tiene unidades: usá un sistema coherente en todos los datos (por ejemplo k en kN/mm, cargas en kN y desplazamientos en mm) y los resultados salen en ese mismo sistema.",
    "Si al poner una k en cero aparece #¡NUM! en la solución, una parte del sistema quedó sin nada que la sujete —es un mecanismo— y Kff no se puede invertir.",
  ];
  notes.forEach((note, i) => {
    data.text(2 + i, 1, note, "note");
    data.merge(2 + i, 1, 1, 6);
  });

  const nodeHeader = 7;
  ["Nudo", "Fuerza", "Restringido", "Desplaz. prescrito"].forEach((title, i) =>
    data.text(nodeHeader, 1 + i, title, "header"),
  );
  /** Dónde está la carga (si es libre) o el desplazamiento prescrito (si es restringido) de cada nudo. */
  const forceRef = new Map<string, string>();
  const prescribedRef = new Map<string, string>();
  nodes.forEach((node, i) => {
    const row = nodeHeader + 1 + i;
    data.text(row, 1, node.name, "fixed");
    // Lo que el cálculo ignoraría no se ofrece: la carga de un apoyo la toma
    // el apoyo, y un nudo libre no tiene desplazamiento prescrito.
    if (node.restrained) {
      data.text(row, 2, NOT_APPLICABLE, "fixed");
      data.set(row, 4, { role: "input", value: node.displacement });
      prescribedRef.set(node.id, data.ref(row, 4));
    } else {
      data.set(row, 2, { role: "input", value: node.force });
      data.text(row, 4, NOT_APPLICABLE, "fixed");
      forceRef.set(node.id, data.ref(row, 2));
    }
    data.text(row, 3, node.restrained ? "Sí" : "No", "fixed");
  });

  const springHeader = nodeHeader + nodes.length + 2;
  ["Resorte", "Desde", "Hacia", "Rigidez k"].forEach((title, i) => data.text(springHeader, 1 + i, title, "header"));
  const kRef = new Map<string, string>();
  elements.forEach((element, i) => {
    const row = springHeader + 1 + i;
    data.text(row, 1, element.name, "fixed");
    data.text(row, 2, nodesById.get(element.fromNodeId)!.name, "fixed");
    data.text(row, 3, nodesById.get(element.toNodeId)!.name, "fixed");
    data.set(row, 4, { role: "input", value: element.k });
    kRef.set(element.id, data.ref(row, 4));
  });
  data.width(1, 12);
  for (let col = 2; col <= 6; col++) data.width(col, 18);

  // ---------------------------------------------------------------- Resortes
  const springs = new SheetBuilder(SPRINGS_SHEETS.springs);
  springs.text(
    1,
    1,
    "Cada resorte aporta k·[[1, −1], [−1, 1]]: desplazar un extremo una unidad con el otro quieto pide k en ese extremo y aparece −k en el otro. No hay transformación: el resorte ya está sobre el único eje del sistema.",
    "note",
  );
  springs.merge(1, 1, 1, 6);
  const BLOCK = 5;
  const stiffnessCell = new Map<string, (i: number, j: number) => string>();
  elements.forEach((element, n) => {
    const top = 3 + n * BLOCK;
    const from = nodesById.get(element.fromNodeId)!.name;
    const to = nodesById.get(element.toNodeId)!.name;
    const { dofs } = stepByElement.get(element.id)!;
    const k = kRef.get(element.id)!;

    springs.text(top, 1, `Resorte ${element.name}: de ${from} a ${to}`, "subtitle");
    // Con el grado global al que va cada fila y columna: así se ve dónde suma
    // en la hoja Ensamblaje.
    const labels = [`${from} → ${dofs[0]}`, `${to} → ${dofs[1]}`];
    labels.forEach((label, j) => {
      springs.text(top + 1, 2 + j, label, "header");
      springs.text(top + 2 + j, 1, label, "label");
    });
    [
      [k, `-${k}`],
      [`-${k}`, k],
    ].forEach((row, i) =>
      row.forEach((formula, j) =>
        springs.formula(top + 2 + i, 2 + j, formula, i === j ? element.k : -element.k),
      ),
    );
    stiffnessCell.set(element.id, (i, j) => springs.ref(top + 2 + i, 2 + j));
  });
  for (let col = 1; col <= 3; col++) springs.width(col, 14);

  // -------------------------------------------- Ensamblaje y Solución (comunes)
  const { assembly, solution, ufRef, rrRef } = buildMatrixMethodSheets({
    solved,
    dofLabel,
    elementIds: elements.map((element) => element.id),
    stiffnessRef: (id, i, j) => stiffnessCell.get(id)!(i, j),
    force: (g) => {
      const nodeId = dofOrder[g].nodeId;
      return { ref: forceRef.get(nodeId)!, value: nodesById.get(nodeId)!.force };
    },
    prescribedRef: (g) => prescribedRef.get(dofOrder[g].nodeId)!,
    assemblyNote:
      "Cada celda suma lo que aporta cada resorte que une los nudos de su fila y su columna. Un 0 es un par de nudos que ningún resorte une.",
  });

  // ---------------------------------------------------------------- Resultados
  const results = new SheetBuilder(SPRINGS_SHEETS.results);
  results.text(1, 1, "Resultados", "title");
  ["Nudo", "Desplazamiento", "Reacción"].forEach((title, i) => results.text(3, 1 + i, title, "header"));
  const displacementRef = new Map<string, string>();
  nodes.forEach((node, i) => {
    const row = 4 + i;
    const g = globalIndexOf.get(node.id)!;
    results.text(row, 1, node.name, "fixed");
    // El desplazamiento de un nudo restringido es el prescrito: se lee de Datos.
    const source = node.restrained ? prescribedRef.get(node.id)! : ufRef.get(g)!;
    results.formula(row, 2, source, solved.displacements.get(node.id)![0]);
    displacementRef.set(node.id, results.ref(row, 2));
    if (node.restrained) results.formula(row, 3, rrRef.get(g)!, solved.reactions.get(node.id)![0]);
    else results.text(row, 3, NOT_APPLICABLE, "fixed");
  });

  const forcesTop = 4 + nodes.length + 2;
  results.text(forcesTop, 1, "Fuerza en cada resorte", "subtitle");
  results.text(
    forcesTop + 1,
    1,
    "F = k · (u_hacia − u_desde). Con el eje positivo yendo de «desde» a «hacia», positivo = estirado y negativo = comprimido. Esa convención es la única forma de leer el signo: el sistema no tiene geometría.",
    "note",
  );
  results.merge(forcesTop + 1, 1, 1, 5);
  results.text(forcesTop + 2, 1, "Resorte", "header");
  results.text(forcesTop + 2, 2, "Fuerza F", "header");
  elements.forEach((element, i) => {
    const row = forcesTop + 3 + i;
    const formula = `${kRef.get(element.id)!}*(${displacementRef.get(element.toNodeId)!}-${displacementRef.get(element.fromNodeId)!})`;
    results.text(row, 1, element.name, "fixed");
    results.formula(row, 2, formula, (solved.internalForces.get(element.id) as SpringInternalForce).axialForce);
  });

  // El cierre del pizarrón en su versión global: lo que empujan las cargas lo
  // devuelven los apoyos.
  const checkTop = forcesTop + 3 + elements.length + 1;
  results.text(checkTop, 1, "Control de equilibrio global: cargas + reacciones, tiene que dar 0", "subtitle");
  const terms = nodes.map((node, i) => (node.restrained ? results.ref(4 + i, 3) : forceRef.get(node.id)!));
  const total = nodes.reduce(
    (sum, node) => sum + (node.restrained ? solved.reactions.get(node.id)![0] : node.force),
    0,
  );
  results.text(checkTop + 1, 1, "Suma", "label");
  results.formula(checkTop + 1, 2, terms.join("+"), total);
  results.width(1, 12);
  for (let col = 2; col <= 3; col++) results.width(col, 18);

  return { sheets: [data.sheet, springs.sheet, assembly, solution, results.sheet] };
}
