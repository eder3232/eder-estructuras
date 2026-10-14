import { TrussElement2D, type SolveResult, type TrussInternalForce } from "@/lib/engine";
import { SheetBuilder, address, rangeAddress, type SheetImage, type WorkbookModel } from "./workbook-model";

/**
 * El libro de Excel de una armadura plana, **con el método vivo**: las
 * coordenadas, las cargas, los desplazamientos prescritos, el área y la
 * elasticidad son celdas, y todo lo demás —longitud, cosenos, la rigidez de
 * cada barra, `K`, la partición, la solución y las fuerzas axiales— son
 * fórmulas que se recalculan al editarlas. Sin macros: `.xlsx` puro.
 *
 * **Qué queda fijo, y por qué.** La conectividad y los apoyos deciden *dónde*
 * cae cada número: qué términos de cada barra se suman en cada celda de `K`, y
 * qué filas van a `Kff` y cuáles a `Krr`. Eso queda escrito en las fórmulas, así
 * que cambiarlo es generar otro libro. Los apoyos se podrían dejar vivos
 * resolviendo la matriz entera con una identidad en cada grado restringido,
 * pero el libro dejaría de mostrar la partición como se hace en el pizarrón — y
 * esa fue la decisión del usuario (2026-10-14): partición a la vista, apoyos
 * fijos, y el libro lo dice.
 *
 * El recorrido de `K` es el del motor (`AssemblyStep.dofs`): el libro no
 * reinventa el ensamblaje, lo escribe como fórmula. Cada fórmula lleva al lado
 * el número que dio el motor, así que el archivo se ve bien aunque Excel no
 * llegue a recalcular.
 */

export interface Truss2DNodeInput {
  id: string;
  name: string;
  x: number;
  z: number;
  forceX: number;
  forceZ: number;
  displacementX: number;
  displacementZ: number;
  restrainedX: boolean;
  restrainedZ: boolean;
}

export interface Truss2DElementInput {
  id: string;
  name: string;
  fromNodeId: string;
  toNodeId: string;
  area: number;
  elasticity: number;
}

export interface Truss2DWorkbookInput {
  nodes: Truss2DNodeInput[];
  elements: Truss2DElementInput[];
  /** Tiene que ser la solución de **estos** nudos y barras: de ahí sale el orden de grados de libertad. */
  solved: SolveResult;
  /** El esquema sin cargas, ya en PNG. Opcional: el libro funciona igual sin él. */
  schema?: Omit<SheetImage, "row" | "col">;
}

export const SHEETS = {
  data: "Datos",
  bars: "Barras",
  assembly: "Ensamblaje",
  solution: "Solución",
  results: "Resultados",
} as const;

const AXES = ["x", "z"] as const;
const NOT_APPLICABLE = "—";

/** Dónde quedó, en la hoja Datos, cada dato de un nudo. `null` donde no aplica. */
interface NodeRefs {
  x: string;
  z: string;
  force: (string | null)[];
  displacement: (string | null)[];
}

/** Las celdas de una barra en la hoja Barras. */
interface BarRefs {
  cos: string;
  sin: string;
  eaOverL: string;
  /** Celda de `K_e[i][j]`, la rigidez de la barra en ejes globales. */
  stiffness: (i: number, j: number) => string;
}

export function buildTruss2DWorkbook({ nodes, elements, solved, schema }: Truss2DWorkbookInput): WorkbookModel {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const { dofOrder, partition, globalStiffness, steps } = solved.assembly;
  const dofLabel = (globalIndex: number) => {
    const entry = dofOrder[globalIndex];
    return `${nodesById.get(entry.nodeId)!.name} ${AXES[entry.localDof]}`;
  };

  // ---------------------------------------------------------------- Datos
  const data = new SheetBuilder(SHEETS.data);
  data.text(1, 1, "Armadura plana — método matricial de rigideces", "title");
  const notes = [
    "Las celdas amarillas se pueden editar: coordenadas, cargas, desplazamientos prescritos, área y elasticidad. Todo lo demás son fórmulas y se recalcula solo.",
    "Los apoyos y las conexiones entre barras NO se editan en este libro: deciden cómo se arma y cómo se parte la matriz global. Para cambiarlos, volvé a Eder Estructuras y generá otro Excel.",
    "El libro no tiene unidades: usá un sistema coherente en todos los datos (por ejemplo tonf y cm) y los resultados salen en ese mismo sistema.",
    "Si al cambiar la geometría aparece #¡NUM! en la solución, la estructura quedó inestable —es un mecanismo— y Kff no se puede invertir.",
  ];
  notes.forEach((note, i) => {
    data.text(2 + i, 1, note, "note");
    data.merge(2 + i, 1, 1, 9);
  });

  const nodeHeader = 7;
  [
    "Nudo",
    "x",
    "z",
    "Fuerza X",
    "Fuerza Z",
    "Restringido X",
    "Restringido Z",
    "Desplaz. prescrito X",
    "Desplaz. prescrito Z",
  ].forEach((title, i) => data.text(nodeHeader, 1 + i, title, "header"));

  const nodeRefs = new Map<string, NodeRefs>();
  nodes.forEach((node, i) => {
    const row = nodeHeader + 1 + i;
    const restrained = [node.restrainedX, node.restrainedZ];
    const force = [node.forceX, node.forceZ];
    const displacement = [node.displacementX, node.displacementZ];

    data.text(row, 1, node.name, "fixed");
    data.set(row, 2, { role: "input", value: node.x });
    data.set(row, 3, { role: "input", value: node.z });
    const refs: NodeRefs = { x: data.ref(row, 2), z: data.ref(row, 3), force: [], displacement: [] };

    AXES.forEach((_, d) => {
      // Una carga sobre un grado restringido la toma el apoyo, y un
      // desplazamiento prescrito sobre uno libre no existe: esas celdas no se
      // ofrecen, en vez de aceptar un dato que el cálculo ignoraría.
      if (restrained[d]) {
        data.text(row, 4 + d, NOT_APPLICABLE, "fixed");
        data.set(row, 8 + d, { role: "input", value: displacement[d] });
        refs.force.push(null);
        refs.displacement.push(data.ref(row, 8 + d));
      } else {
        data.set(row, 4 + d, { role: "input", value: force[d] });
        data.text(row, 8 + d, NOT_APPLICABLE, "fixed");
        refs.force.push(data.ref(row, 4 + d));
        refs.displacement.push(null);
      }
      data.text(row, 6 + d, restrained[d] ? "Sí" : "No", "fixed");
    });
    nodeRefs.set(node.id, refs);
  });

  const barHeader = nodeHeader + nodes.length + 2;
  ["Barra", "Desde", "Hacia", "Área (A)", "Elasticidad (E)"].forEach((title, i) =>
    data.text(barHeader, 1 + i, title, "header"),
  );
  const barDataRow = new Map<string, number>();
  elements.forEach((element, i) => {
    const row = barHeader + 1 + i;
    barDataRow.set(element.id, row);
    data.text(row, 1, element.name, "fixed");
    data.text(row, 2, nodesById.get(element.fromNodeId)!.name, "fixed");
    data.text(row, 3, nodesById.get(element.toNodeId)!.name, "fixed");
    data.set(row, 4, { role: "input", value: element.area });
    data.set(row, 5, { role: "input", value: element.elasticity });
  });

  data.width(1, 10);
  for (let col = 2; col <= 9; col++) data.width(col, 14);
  if (schema) {
    data.text(nodeHeader - 1, 11, "Esquema (la geometría con la que se generó el libro)", "label");
    data.image({ ...schema, row: nodeHeader, col: 11 });
  }

  // ---------------------------------------------------------------- Barras
  const bars = new SheetBuilder(SHEETS.bars);
  const BLOCK = 9;
  const stepByElement = new Map(steps.map((step) => [step.elementId, step]));
  const barRefs = new Map<string, BarRefs>();

  elements.forEach((element, i) => {
    const top = 1 + i * BLOCK;
    const from = nodesById.get(element.fromNodeId)!;
    const to = nodesById.get(element.toNodeId)!;
    const a = nodeRefs.get(from.id)!;
    const b = nodeRefs.get(to.id)!;
    const dataRow = barDataRow.get(element.id)!;
    const areaRef = data.ref(dataRow, 4);
    const elasticityRef = data.ref(dataRow, 5);
    const breakdown = new TrussElement2D(
      element.id,
      { id: from.id, x: from.x, z: from.z },
      { id: to.id, x: to.x, z: to.z },
      element.area,
      element.elasticity,
    ).breakdown();

    bars.text(top, 1, `Barra ${element.name}: de ${from.name} a ${to.name}`, "subtitle");

    const props = top + 1;
    const L = address(props, 2);
    const c = address(props, 4);
    const s = address(props, 6);
    const eaOverL = address(props, 8);
    bars.text(props, 1, "L");
    bars.formula(props, 2, `SQRT((${b.x}-${a.x})^2+(${b.z}-${a.z})^2)`, breakdown.length);
    bars.text(props, 3, "c = Δx/L");
    bars.formula(props, 4, `(${b.x}-${a.x})/${L}`, breakdown.cos);
    bars.text(props, 5, "s = Δz/L");
    bars.formula(props, 6, `(${b.z}-${a.z})/${L}`, breakdown.sin);
    bars.text(props, 7, "EA/L");
    bars.formula(props, 8, `${areaRef}*${elasticityRef}/${L}`, breakdown.eaOverL);

    const labelsRow = top + 2;
    const matrixTop = top + 4;
    const step = stepByElement.get(element.id)!;
    const localLabels = [`${from.name} x`, `${from.name} z`, `${to.name} x`, `${to.name} z`];

    // A (4×2): lleva los dos grados axiales a los cuatro globales de la barra.
    bars.text(labelsRow, 1, "A (transformación)", "label");
    const transform = [
      [c, null],
      [s, null],
      [null, c],
      [null, s],
    ];
    transform.forEach((row, r) => {
      bars.text(matrixTop + r, 1, localLabels[r], "label");
      row.forEach((ref, col) => {
        if (ref) bars.formula(matrixTop + r, 2 + col, ref, breakdown.transform[r][col]);
        else bars.set(matrixTop + r, 2 + col, { role: "computed", value: 0 });
      });
    });

    // k (2×2) en ejes locales: EA/L · [[1, −1], [−1, 1]].
    bars.text(labelsRow, 5, "k (local)", "label");
    [
      [eaOverL, `-${eaOverL}`],
      [`-${eaOverL}`, eaOverL],
    ].forEach((row, r) =>
      row.forEach((formula, col) => bars.formula(matrixTop + r, 5 + col, formula, breakdown.localStiffness[r][col])),
    );

    // K de la barra = A · k · Aᵀ, con los grados globales a los que va cada fila.
    bars.text(labelsRow, 8, "K de la barra = A · k · Aᵀ (a qué posición de K va cada fila y columna)", "label");
    const keCol = 9;
    step.dofs.forEach((globalIndex, j) => {
      bars.text(matrixTop - 1, keCol + j, `${localLabels[j]} → ${globalIndex}`, "header");
      bars.text(matrixTop + j, keCol - 1, `${localLabels[j]} → ${globalIndex}`, "label");
    });
    const A = rangeAddress(matrixTop, 2, 4, 2);
    const k = rangeAddress(matrixTop, 5, 2, 2);
    bars.array(matrixTop, keCol, `MMULT(MMULT(${A},${k}),TRANSPOSE(${A}))`, breakdown.globalStiffness);

    barRefs.set(element.id, {
      cos: bars.ref(props, 4),
      sin: bars.ref(props, 6),
      eaOverL: bars.ref(props, 8),
      stiffness: (r, col) => bars.ref(matrixTop + r, keCol + col),
    });
  });
  for (let col = 1; col <= 8; col++) bars.width(col, 12);
  for (let col = 9; col <= 12; col++) bars.width(col, 14);

  // ---------------------------------------------------------------- Ensamblaje
  const assembly = new SheetBuilder(SHEETS.assembly);
  const t = globalStiffness.length;
  assembly.text(1, 1, "Matriz de rigidez global K", "title");
  assembly.text(
    2,
    1,
    "Cada celda suma lo que aporta cada barra que toca los dos nudos de su fila y su columna. Un 0 es un par de nudos que ninguna barra conecta.",
    "note",
  );
  assembly.merge(2, 1, 1, Math.max(t + 1, 10));

  // Qué celdas de qué barras caen en cada (fila, columna) de K: el recorrido
  // del motor, escrito como referencias en vez de sumado.
  const contributions: string[][][] = Array.from({ length: t }, () => Array.from({ length: t }, () => []));
  for (const element of elements) {
    const { dofs } = stepByElement.get(element.id)!;
    const refs = barRefs.get(element.id)!;
    dofs.forEach((row, i) => dofs.forEach((col, j) => contributions[row][col].push(refs.stiffness(i, j))));
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

  // ---------------------------------------------------------------- Solución
  const solution = new SheetBuilder(SHEETS.solution);
  const { free, restrained } = partition;
  const nf = free.length;
  const nr = restrained.length;
  solution.text(1, 1, "Partición y solución", "title");
  solution.text(
    2,
    1,
    "K se parte en grados libres (f) y restringidos (r). Los desplazamientos libres salen de Uf = Kff⁻¹ · (Ff − Kfr · Ur) y las reacciones de Rr = Krf · Uf + Krr · Ur.",
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

  /** Un vector columna con sus etiquetas. `cell` escribe cada fila y devuelve nada. */
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
  const ufLeft = 7;
  const rrLeft = 10;
  const ff = vector("Ff (cargas)", ffLeft, free, (row, col, g) => {
    const entry = dofOrder[g];
    const ref = nodeRefs.get(entry.nodeId)!.force[entry.localDof]!;
    solution.formula(row, col, ref, nodesById.get(entry.nodeId)![entry.localDof === 0 ? "forceX" : "forceZ"]);
  });
  const ur = vector("Ur (desplaz. prescritos)", urLeft, restrained, (row, col, g) => {
    const entry = dofOrder[g];
    const ref = nodeRefs.get(entry.nodeId)!.displacement[entry.localDof]!;
    solution.formula(row, col, ref, valueAt(solved.displacements, g));
  });

  /** Dónde quedó cada desplazamiento libre y cada reacción, para la hoja de resultados. */
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
    const rhs = nr > 0 ? `${ff}-MMULT(${kfr},${ur})` : ff;
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
    uf ? `MMULT(${krf},${uf})+MMULT(${krr},${ur})` : `MMULT(${krr},${ur})`,
    restrained.map((g) => [valueAt(solved.reactions, g)]),
  );
  for (let col = 1; col <= Math.max(rightLeft + nr, rrLeft + 1); col++) solution.width(col, 13);

  // ---------------------------------------------------------------- Resultados
  const results = new SheetBuilder(SHEETS.results);
  results.text(1, 1, "Resultados", "title");
  ["Nudo", "Desplazamiento X", "Desplazamiento Z", "Reacción X", "Reacción Z"].forEach((title, i) =>
    results.text(3, 1 + i, title, "header"),
  );

  const globalIndexOf = new Map(dofOrder.map((entry) => [`${entry.nodeId}:${entry.localDof}`, entry.globalIndex]));
  const displacementRef = new Map<string, string>();
  nodes.forEach((node, i) => {
    const row = 4 + i;
    results.text(row, 1, node.name, "fixed");
    AXES.forEach((_, d) => {
      const g = globalIndexOf.get(`${node.id}:${d}`)!;
      const isRestrained = d === 0 ? node.restrainedX : node.restrainedZ;
      // El desplazamiento de un grado restringido es el prescrito: se lee de
      // Datos, no de la solución.
      const source = isRestrained ? nodeRefs.get(node.id)!.displacement[d]! : ufRef.get(g)!;
      results.formula(row, 2 + d, source, solved.displacements.get(node.id)![d]);
      displacementRef.set(`${node.id}:${d}`, results.ref(row, 2 + d));
      if (isRestrained) results.formula(row, 4 + d, rrRef.get(g)!, solved.reactions.get(node.id)![d]);
      else results.text(row, 4 + d, NOT_APPLICABLE, "fixed");
    });
  });

  const barsTop = 4 + nodes.length + 2;
  results.text(barsTop, 1, "Fuerza axial en cada barra", "subtitle");
  results.text(
    barsTop + 1,
    1,
    "N = EA/L · (c·(u₂ₓ − u₁ₓ) + s·(u₂z − u₁z)), con 1 el nudo «desde» y 2 el «hacia». Positivo = tracción, negativo = compresión.",
    "note",
  );
  results.merge(barsTop + 1, 1, 1, 5);
  results.text(barsTop + 2, 1, "Barra", "header");
  results.text(barsTop + 2, 2, "Fuerza axial N", "header");
  elements.forEach((element, i) => {
    const row = barsTop + 3 + i;
    const refs = barRefs.get(element.id)!;
    const u = (nodeId: string, d: number) => displacementRef.get(`${nodeId}:${d}`)!;
    const formula =
      `${refs.eaOverL}*(${refs.cos}*(${u(element.toNodeId, 0)}-${u(element.fromNodeId, 0)})` +
      `+${refs.sin}*(${u(element.toNodeId, 1)}-${u(element.fromNodeId, 1)}))`;
    results.text(row, 1, element.name, "fixed");
    results.formula(row, 2, formula, (solved.internalForces.get(element.id) as TrussInternalForce).axialForce);
  });

  // El cierre del pizarrón, en su versión global: lo que empujan las cargas lo
  // devuelven los apoyos. Si no da cero, algo del libro está mal.
  const checkTop = barsTop + 3 + elements.length + 1;
  results.text(checkTop, 1, "Control de equilibrio global: cargas + reacciones, tiene que dar 0", "subtitle");
  AXES.forEach((axis, d) => {
    const refs = nodes.map((node) => {
      const isRestrained = d === 0 ? node.restrainedX : node.restrainedZ;
      return isRestrained ? results.ref(4 + nodes.indexOf(node), 4 + d) : nodeRefs.get(node.id)!.force[d]!;
    });
    const total = nodes.reduce((sum, node) => {
      const isRestrained = d === 0 ? node.restrainedX : node.restrainedZ;
      return sum + (isRestrained ? solved.reactions.get(node.id)![d] : d === 0 ? node.forceX : node.forceZ);
    }, 0);
    results.text(checkTop + 1 + d, 1, `Suma ${axis.toUpperCase()}`, "label");
    results.formula(checkTop + 1 + d, 2, refs.join("+"), total);
  });
  results.width(1, 10);
  for (let col = 2; col <= 5; col++) results.width(col, 18);

  return { sheets: [data.sheet, bars.sheet, assembly.sheet, solution.sheet, results.sheet] };
}
