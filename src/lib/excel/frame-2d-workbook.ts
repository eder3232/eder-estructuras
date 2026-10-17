import {
  FrameElement2D,
  loadFixedEndForces,
  memberAxis,
  type FrameFixedEndForces,
  type FrameInternalForce,
  type LoadDirection,
  type MemberAxis,
  type MemberLoad,
  type SolveResult,
} from "@/lib/engine";
import { buildMatrixMethodSheets, MATRIX_METHOD_SHEETS } from "./matrix-method-sheets";
import { SheetBuilder, address, rangeAddress, type WorkbookModel } from "./workbook-model";

/**
 * El libro de Excel de un pórtico plano, **con el método vivo** — el de las
 * armaduras (ver `truss-2d-workbook.ts`, que explica qué queda fijo y por qué)
 * con lo que tiene un pórtico y no una armadura:
 *
 * - La rigidez de 6×6 con flexión: `K = Tᵀ·k·T`, con `k` armada con
 *   `EA/L`, `12EI/L³`, `6EI/L²`, `4EI/L` y `2EI/L`.
 * - **Las cargas en las barras, con su FEM como fórmula viva.** Cada carga es
 *   una fila de la hoja Cargas; sus valores y posiciones se editan, y el FEM
 *   se recalcula con la misma integral exacta que usa el motor
 *   (`member-loads.ts`): la carga contra las funciones de forma, con tres
 *   puntos de Gauss para una distribuida y uno para una puntual. Así una carga
 *   parcial o triangular sigue viva, no solo las tres de la tabla.
 * - `F = K·U + FEM` en la solución (ver `matrix-method-sheets.ts`).
 *
 * **Fijo, y el libro lo dice**: los apoyos, la conectividad, y de cada carga su
 * barra, su tipo, su dirección y si es por planta. Deciden dónde cae cada
 * número y qué fórmula lo calcula. **Sin diagramas** (decisión del 2026-10-17,
 * `docs/frame2d-v1.md`): llega hasta las fuerzas de extremo.
 */

export interface Frame2DNodeInput {
  id: string;
  name: string;
  x: number;
  z: number;
  forceX: number;
  forceZ: number;
  momentR: number;
  displacementX: number;
  displacementZ: number;
  displacementR: number;
  restrainedX: boolean;
  restrainedZ: boolean;
  restrainedR: boolean;
}

export interface Frame2DElementInput {
  id: string;
  name: string;
  fromNodeId: string;
  toNodeId: string;
  area: number;
  elasticity: number;
  inertia: number;
  manualFem: boolean;
  femAxialFrom: number;
  femShearFrom: number;
  femMomentFrom: number;
  femAxialTo: number;
  femShearTo: number;
  femMomentTo: number;
}

export interface Frame2DLoadInput {
  id: string;
  name: string;
  elementId: string;
  kind: "distributed" | "point" | "moment";
  direction: LoadDirection;
  q1: number;
  q2: number;
  wholeBar: boolean;
  a: number;
  b: number;
  projected: boolean;
}

export interface Frame2DWorkbookInput {
  nodes: Frame2DNodeInput[];
  elements: Frame2DElementInput[];
  loads: Frame2DLoadInput[];
  /** Tiene que ser la solución de **este** modelo: de ahí sale el orden de grados de libertad. */
  solved: SolveResult;
}

export const FRAME_2D_SHEETS = {
  data: "Datos",
  loads: "Cargas",
  bars: "Barras",
  assembly: MATRIX_METHOD_SHEETS.assembly,
  solution: MATRIX_METHOD_SHEETS.solution,
  results: "Resultados",
} as const;

const AXES = ["x", "z", "θ"] as const;
const LOCAL = ["x′", "y′", "θ"] as const;
const NOT_APPLICABLE = "—";

const forces = (n: Frame2DNodeInput) => [n.forceX, n.forceZ, n.momentR];
const displacements = (n: Frame2DNodeInput) => [n.displacementX, n.displacementZ, n.displacementR];
const restraints = (n: Frame2DNodeInput) => [n.restrainedX, n.restrainedZ, n.restrainedR];
const manualFem = (e: Frame2DElementInput) => [
  e.femAxialFrom,
  e.femShearFrom,
  e.femMomentFrom,
  e.femAxialTo,
  e.femShearTo,
  e.femMomentTo,
];
const femVector = ({ from, to }: FrameFixedEndForces) => [
  from.axial,
  from.shear,
  from.moment,
  to.axial,
  to.shear,
  to.moment,
];

const KIND_LABEL = { distributed: "Distribuida", point: "Puntual", moment: "Momento" } as const;
const DIRECTION_LABEL: Record<LoadDirection, string> = {
  perpendicular: "Perpendicular (y′)",
  axial: "Axial (x′)",
  globalX: "Horizontal (X)",
  globalZ: "Vertical (Z)",
};

/** Gauss–Legendre de 3 puntos en [−1, 1]: la misma cuadratura que `member-loads.ts`, exacta para estas cargas. */
const GAUSS_T = [-Math.sqrt(3 / 5), 0, Math.sqrt(3 / 5)];
const GAUSS_W = [5 / 9, 8 / 9, 5 / 9];

/** Lo que una fila significa para el motor (lo mismo que `toMemberLoad` del store de `/frame2d`). */
function toMemberLoad(load: Frame2DLoadInput, length: number): MemberLoad {
  if (load.kind === "moment") return { kind: "moment", value: load.q1, a: load.a };
  if (load.kind === "point") return { kind: "point", direction: load.direction, value: load.q1, a: load.a };
  return {
    kind: "distributed",
    direction: load.direction,
    q1: load.q1,
    q2: load.q2,
    a: load.wholeBar ? 0 : load.a,
    b: load.wholeBar ? length : load.b,
    projected: load.projected && (load.direction === "globalX" || load.direction === "globalZ"),
  };
}

interface NodeRefs {
  coordinates: [string, string];
  force: (string | null)[];
  displacement: (string | null)[];
}

interface BarRefs {
  length: string;
  cos: string;
  sin: string;
  /** Celda de `K_e[i][j]`, en ejes globales. */
  stiffness: (i: number, j: number) => string;
  /** Rangos de `T`, `k` y del FEM local, para las fuerzas de extremo. */
  transform: string;
  local: string;
  femLocal: string;
  /** Componente `i` del FEM en ejes globales. */
  femGlobal: (i: number) => string;
}

export function buildFrame2DWorkbook({ nodes, elements, loads, solved }: Frame2DWorkbookInput): WorkbookModel {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const { dofOrder, steps } = solved.assembly;
  const dofLabel = (g: number) => {
    const entry = dofOrder[g];
    return `${nodesById.get(entry.nodeId)!.name} ${AXES[entry.localDof]}`;
  };
  const axes = new Map<string, MemberAxis>(
    elements.map((e) => [e.id, memberAxis(nodesById.get(e.fromNodeId)!, nodesById.get(e.toNodeId)!)]),
  );

  // ---------------------------------------------------------------- Datos
  // Nudos: nombre, x, z, tres cargas, tres restricciones, tres prescritos.
  const COORD = 2;
  const FORCE = 4;
  const RESTRAINED = 7;
  const PRESCRIBED = 10;

  const data = new SheetBuilder(FRAME_2D_SHEETS.data);
  data.text(1, 1, "Pórtico plano — método matricial de rigideces", "title");
  const notes = [
    "Las celdas amarillas se pueden editar: coordenadas, cargas en los nudos, desplazamientos prescritos, A, I y E de cada barra, y los valores y las posiciones de las cargas en las barras (hoja Cargas). Todo lo demás son fórmulas y se recalcula solo.",
    "Los apoyos, las conexiones entre barras y, de cada carga, su barra, su tipo, su dirección y si es por planta NO se editan acá: deciden cómo se arma y se parte la matriz global y con qué fórmula se calcula cada FEM. Para cambiarlos, volvé a Eder Estructuras y generá otro Excel.",
    "El libro no tiene unidades: usá un sistema coherente en todos los datos (por ejemplo tonf y m: E en tonf/m², I en m⁴, momentos en tonf·m) y los resultados salen en ese mismo sistema.",
    "Si al cambiar la geometría aparece #¡NUM! en la solución, la estructura quedó inestable —es un mecanismo— y Kff no se puede invertir.",
    "Llega hasta las fuerzas de extremo de cada barra (hoja Resultados). Los diagramas y la deformada están en la app.",
  ];
  notes.forEach((note, i) => {
    data.text(2 + i, 1, note, "note");
    data.merge(2 + i, 1, 1, 13);
  });

  const nodeHeader = 2 + notes.length + 1;
  [
    "Nudo",
    "x",
    "z",
    "Fuerza X",
    "Fuerza Z",
    "Momento",
    "Restringido X",
    "Restringido Z",
    "Restringido θ",
    "Desplaz. prescrito X",
    "Desplaz. prescrito Z",
    "Giro prescrito",
  ].forEach((title, i) => data.text(nodeHeader, 1 + i, title, "header"));

  const nodeRefs = new Map<string, NodeRefs>();
  nodes.forEach((node, i) => {
    const row = nodeHeader + 1 + i;
    const restrained = restraints(node);
    data.text(row, 1, node.name, "fixed");
    data.set(row, COORD, { role: "input", value: node.x });
    data.set(row, COORD + 1, { role: "input", value: node.z });
    const refs: NodeRefs = { coordinates: [data.ref(row, COORD), data.ref(row, COORD + 1)], force: [], displacement: [] };
    AXES.forEach((_, d) => {
      // Una carga sobre un grado restringido la toma el apoyo, y un
      // desplazamiento prescrito sobre uno libre no existe: no se ofrecen.
      if (restrained[d]) {
        data.text(row, FORCE + d, NOT_APPLICABLE, "fixed");
        data.set(row, PRESCRIBED + d, { role: "input", value: displacements(node)[d] });
        refs.force.push(null);
        refs.displacement.push(data.ref(row, PRESCRIBED + d));
      } else {
        data.set(row, FORCE + d, { role: "input", value: forces(node)[d] });
        data.text(row, PRESCRIBED + d, NOT_APPLICABLE, "fixed");
        refs.force.push(data.ref(row, FORCE + d));
        refs.displacement.push(null);
      }
      data.text(row, RESTRAINED + d, restrained[d] ? "Sí" : "No", "fixed");
    });
    nodeRefs.set(node.id, refs);
  });

  const barHeader = nodeHeader + nodes.length + 2;
  [
    "Barra",
    "Desde",
    "Hacia",
    "Área (A)",
    "Inercia (I)",
    "Elasticidad (E)",
    "FEM a mano",
    "FEM N desde",
    "FEM V desde",
    "FEM M desde",
    "FEM N hacia",
    "FEM V hacia",
    "FEM M hacia",
  ].forEach((title, i) => data.text(barHeader, 1 + i, title, "header"));
  const barDataRow = new Map<string, number>();
  elements.forEach((element, i) => {
    const row = barHeader + 1 + i;
    barDataRow.set(element.id, row);
    data.text(row, 1, element.name, "fixed");
    data.text(row, 2, nodesById.get(element.fromNodeId)!.name, "fixed");
    data.text(row, 3, nodesById.get(element.toNodeId)!.name, "fixed");
    data.set(row, 4, { role: "input", value: element.area });
    data.set(row, 5, { role: "input", value: element.inertia });
    data.set(row, 6, { role: "input", value: element.elasticity });
    data.text(row, 7, element.manualFem ? "Sí" : "No", "fixed");
    manualFem(element).forEach((value, k) => {
      // El FEM a mano solo se edita en las barras que lo usan; en las demás
      // sale de las cargas y escribirlo acá no cambiaría nada.
      if (element.manualFem) data.set(row, 8 + k, { role: "input", value });
      else data.text(row, 8 + k, NOT_APPLICABLE, "fixed");
    });
  });
  data.width(1, 10);
  for (let col = 2; col <= 13; col++) data.width(col, 13);

  // ---------------------------------------------------------------- Barras (geometría)
  // La geometría de cada barra va primero, porque las cargas la necesitan (L,
  // c y s) y el FEM de la barra necesita a las cargas.
  const bars = new SheetBuilder(FRAME_2D_SHEETS.bars);
  const BLOCK = 21;
  const barTop = new Map(elements.map((e, i) => [e.id, 1 + i * BLOCK]));
  const lengthRef = (id: string) => bars.ref(barTop.get(id)! + 1, 2);
  const cosRef = (id: string) => bars.ref(barTop.get(id)! + 1, 4);
  const sinRef = (id: string) => bars.ref(barTop.get(id)! + 1, 6);

  // ---------------------------------------------------------------- Cargas
  const loadSheet = new SheetBuilder(FRAME_2D_SHEETS.loads);
  loadSheet.text(1, 1, "Cargas en las barras y su FEM", "title");
  loadSheet.text(
    2,
    1,
    "Editables: el valor (q₁, P o M), q₂ y las posiciones a y b, medidas a lo largo de la barra desde su nudo «desde». El FEM es la integral de la carga contra las funciones de forma de la barra: para una distribuida, con los tres puntos de Gauss (ξ, w); para una puntual, con un solo punto en a. Signo del FEM: el de la reacción del empotramiento, en ejes locales, momento antihorario positivo.",
    "note",
  );
  loadSheet.merge(2, 1, 1, 25);
  const L_COL = {
    name: 1,
    bar: 2,
    kind: 3,
    direction: 4,
    q1: 5,
    q2: 6,
    a: 7,
    b: 8,
    projected: 9,
    length: 10,
    ux: 11,
    uy: 12,
    factor: 13,
    xi: 14,
    w: 17,
    fem: 20,
  } as const;
  const loadHeader = 4;
  [
    "Carga",
    "Barra",
    "Tipo",
    "Dirección",
    "Valor (q₁, P o M)",
    "q₂",
    "a",
    "b",
    "Por planta",
    "L",
    "ux′",
    "uy′",
    "Factor",
    "ξ₁",
    "ξ₂",
    "ξ₃",
    "w₁",
    "w₂",
    "w₃",
    "FEM N desde",
    "FEM V desde",
    "FEM M desde",
    "FEM N hacia",
    "FEM V hacia",
    "FEM M hacia",
  ].forEach((title, i) => loadSheet.text(loadHeader, 1 + i, title, "header"));

  const elementsById = new Map(elements.map((e) => [e.id, e]));
  /** Las celdas del FEM local de cada carga, por barra. */
  const loadFemRefs = new Map<string, string[][]>();
  const usableLoads = loads.filter((load) => {
    const element = elementsById.get(load.elementId);
    return element && !element.manualFem;
  });

  usableLoads.forEach((load, index) => {
    const row = loadHeader + 1 + index;
    const element = elementsById.get(load.elementId)!;
    const axis = axes.get(element.id)!;
    const member = toMemberLoad(load, axis.length);
    const fem = femVector(loadFixedEndForces(member, axis));
    const cell = (col: number) => address(row, col);

    loadSheet.text(row, L_COL.name, load.name, "fixed");
    loadSheet.text(row, L_COL.bar, element.name, "fixed");
    loadSheet.text(row, L_COL.kind, KIND_LABEL[load.kind], "fixed");
    loadSheet.text(row, L_COL.direction, load.kind === "moment" ? "antihorario +" : DIRECTION_LABEL[load.direction], "fixed");
    loadSheet.set(row, L_COL.q1, { role: "input", value: load.q1 });
    loadSheet.formula(row, L_COL.length, lengthRef(element.id), axis.length);

    const distributed = load.kind === "distributed";
    if (distributed) {
      loadSheet.set(row, L_COL.q2, { role: "input", value: load.q2 });
    } else loadSheet.text(row, L_COL.q2, NOT_APPLICABLE, "fixed");

    if (distributed && load.wholeBar) {
      // «Toda la barra» sigue a la barra: a es 0 y b es su L, viva.
      loadSheet.set(row, L_COL.a, { role: "fixed", value: 0 });
      loadSheet.formula(row, L_COL.b, cell(L_COL.length), axis.length);
    } else {
      loadSheet.set(row, L_COL.a, { role: "input", value: load.a });
      if (distributed) loadSheet.set(row, L_COL.b, { role: "input", value: load.b });
      else loadSheet.text(row, L_COL.b, NOT_APPLICABLE, "fixed");
    }
    const projected = member.kind === "distributed" && member.projected === true;
    loadSheet.text(row, L_COL.projected, projected ? "Sí" : "No", "fixed");

    // La dirección de la carga en ejes de la barra: la misma rotación que T.
    const c = cosRef(element.id);
    const s = sinRef(element.id);
    const unit: Record<LoadDirection, [string | number, string | number, number, number]> = {
      perpendicular: [0, 1, 0, 1],
      axial: [1, 0, 1, 0],
      globalX: [c, `-${s}`, axis.cos, -axis.sin],
      globalZ: [s, c, axis.sin, axis.cos],
    };
    const [uxF, uyF, uxV, uyV] = unit[load.direction];
    const setUnit = (col: number, formula: string | number, value: number) =>
      typeof formula === "number"
        ? loadSheet.set(row, col, { role: "fixed", value: formula })
        : loadSheet.formula(row, col, formula, value);
    const ux = cell(L_COL.ux);
    const uy = cell(L_COL.uy);
    const L = cell(L_COL.length);

    if (load.kind === "moment") {
      loadSheet.text(row, L_COL.ux, NOT_APPLICABLE, "fixed");
      loadSheet.text(row, L_COL.uy, NOT_APPLICABLE, "fixed");
      loadSheet.text(row, L_COL.factor, NOT_APPLICABLE, "fixed");
      // Un momento se reparte con las **derivadas** de las funciones de forma, en ξ = a/L.
      const xi = cell(L_COL.xi);
      const xiValue = load.a / axis.length;
      loadSheet.formula(row, L_COL.xi, `${cell(L_COL.a)}/${L}`, xiValue);
      for (let k = 1; k < 3; k++) loadSheet.text(row, L_COL.xi + k, NOT_APPLICABLE, "fixed");
      for (let k = 0; k < 3; k++) loadSheet.text(row, L_COL.w + k, NOT_APPLICABLE, "fixed");
      const M = cell(L_COL.q1);
      const formulas = [
        "0",
        `-${M}*(-6*${xi}+6*${xi}^2)/${L}`,
        `-${M}*(1-4*${xi}+3*${xi}^2)`,
        "0",
        `-${M}*(6*${xi}-6*${xi}^2)/${L}`,
        `-${M}*(-2*${xi}+3*${xi}^2)`,
      ];
      formulas.forEach((formula, k) => loadSheet.formula(row, L_COL.fem + k, formula, fem[k]));
    } else {
      setUnit(L_COL.ux, uxF, uxV);
      setUnit(L_COL.uy, uyF, uyV);
      const factorValue = projected ? Math.abs(load.direction === "globalZ" ? axis.cos : axis.sin) : 1;
      if (projected) loadSheet.formula(row, L_COL.factor, `ABS(${load.direction === "globalZ" ? c : s})`, factorValue);
      else loadSheet.set(row, L_COL.factor, { role: "fixed", value: 1 });

      // Los puntos de la integral: (ξₖ, wₖ). Una puntual es un solo punto, en
      // a, con todo el valor; una distribuida, los tres puntos de Gauss de
      // [a, b] con su peso por la intensidad en ese punto.
      const xis: number[] = [];
      const ws: number[] = [];
      if (load.kind === "point") {
        xis.push(load.a / axis.length, 0, 0);
        ws.push(load.q1, 0, 0);
        loadSheet.formula(row, L_COL.xi, `${cell(L_COL.a)}/${L}`, xis[0]);
        loadSheet.formula(row, L_COL.w, cell(L_COL.q1), ws[0]);
        for (let k = 1; k < 3; k++) {
          loadSheet.set(row, L_COL.xi + k, { role: "fixed", value: 0 });
          loadSheet.set(row, L_COL.w + k, { role: "fixed", value: 0 });
        }
      } else if (member.kind === "distributed") {
        const a = cell(L_COL.a);
        const b = cell(L_COL.b);
        const q1 = cell(L_COL.q1);
        const q2 = cell(L_COL.q2);
        const f = cell(L_COL.factor);
        GAUSS_T.forEach((t, k) => {
          const x = (member.a + member.b) / 2 + ((member.b - member.a) / 2) * t;
          const q = factorValue * (member.q1 + ((member.q2 - member.q1) * (x - member.a)) / (member.b - member.a));
          xis.push(x / axis.length);
          ws.push((GAUSS_W[k] * (member.b - member.a)) / 2 * q);
          const xFormula = `((${a}+${b})/2+(${b}-${a})/2*(${t}))`;
          loadSheet.formula(row, L_COL.xi + k, `${xFormula}/${L}`, xis[k]);
          loadSheet.formula(
            row,
            L_COL.w + k,
            `${GAUSS_W[k]}*(${b}-${a})/2*${f}*(${q1}+(${q2}-${q1})*(${xFormula}-${a})/(${b}-${a}))`,
            ws[k],
          );
        });
      }

      // FEM = −Σ N(ξₖ)·wₖ·(ux, uy): lineales para la axial, Hermite para la flexión.
      const sum = (shape: (xi: string) => string) =>
        [0, 1, 2].map((k) => `(${shape(address(row, L_COL.xi + k))})*${address(row, L_COL.w + k)}`).join("+");
      const formulas = [
        `-${ux}*(${sum((xi) => `1-${xi}`)})`,
        `-${uy}*(${sum((xi) => `1-3*${xi}^2+2*${xi}^3`)})`,
        `-${uy}*${L}*(${sum((xi) => `${xi}-2*${xi}^2+${xi}^3`)})`,
        `-${ux}*(${sum((xi) => xi)})`,
        `-${uy}*(${sum((xi) => `3*${xi}^2-2*${xi}^3`)})`,
        // `ξ³ − ξ²` y no `−ξ² + ξ³`: en Excel la negación unaria va **antes**
        // que la potencia, así que `-x^2` es (−x)² = x². Así estaba, y el
        // momento del extremo «hacia» salía con el signo del término cambiado
        // en todas las cargas; lo atrapó el test recalculando con HyperFormula.
        `-${uy}*${L}*(${sum((xi) => `${xi}^3-${xi}^2`)})`,
      ];
      formulas.forEach((formula, k) => loadSheet.formula(row, L_COL.fem + k, formula, fem[k]));
    }

    const refs = loadFemRefs.get(element.id) ?? [];
    refs.push([0, 1, 2, 3, 4, 5].map((k) => loadSheet.ref(row, L_COL.fem + k)));
    loadFemRefs.set(element.id, refs);
  });
  if (usableLoads.length === 0) {
    loadSheet.text(loadHeader + 1, 1, "Sin cargas en las barras.", "note");
  }
  loadSheet.width(1, 8);
  loadSheet.width(3, 12);
  loadSheet.width(4, 18);
  for (let col = 5; col <= 25; col++) loadSheet.width(col, 12);

  // ---------------------------------------------------------------- Barras
  const stepByElement = new Map(steps.map((step) => [step.elementId, step]));
  const barRefs = new Map<string, BarRefs>();

  elements.forEach((element) => {
    const top = barTop.get(element.id)!;
    const from = nodesById.get(element.fromNodeId)!;
    const to = nodesById.get(element.toNodeId)!;
    const [ax, az] = nodeRefs.get(from.id)!.coordinates;
    const [bx, bz] = nodeRefs.get(to.id)!.coordinates;
    const dataRow = barDataRow.get(element.id)!;
    const A = data.ref(dataRow, 4);
    const I = data.ref(dataRow, 5);
    const E = data.ref(dataRow, 6);
    const axis = axes.get(element.id)!;
    const frame = new FrameElement2D(
      element.id,
      { id: from.id, x: from.x, z: from.z },
      { id: to.id, x: to.x, z: to.z },
      element.area,
      element.elasticity,
      element.inertia,
    );
    const ei = element.elasticity * element.inertia;
    const length = axis.length;

    bars.text(top, 1, `Barra ${element.name}: de ${from.name} a ${to.name}`, "subtitle");

    // Escalares, de a pares rótulo–valor.
    const r1 = top + 1;
    const r2 = top + 2;
    const L = address(r1, 2);
    bars.text(r1, 1, "L");
    bars.formula(r1, 2, `SQRT((${bx}-${ax})^2+(${bz}-${az})^2)`, length);
    bars.text(r1, 3, "c = Δx/L");
    bars.formula(r1, 4, `(${bx}-${ax})/${L}`, axis.cos);
    bars.text(r1, 5, "s = Δz/L");
    bars.formula(r1, 6, `(${bz}-${az})/${L}`, axis.sin);
    bars.text(r1, 7, "EA/L");
    bars.formula(r1, 8, `${E}*${A}/${L}`, (element.elasticity * element.area) / length);
    bars.text(r2, 1, "12EI/L³");
    bars.formula(r2, 2, `12*${E}*${I}/${L}^3`, (12 * ei) / length ** 3);
    bars.text(r2, 3, "6EI/L²");
    bars.formula(r2, 4, `6*${E}*${I}/${L}^2`, (6 * ei) / length ** 2);
    bars.text(r2, 5, "4EI/L");
    bars.formula(r2, 6, `4*${E}*${I}/${L}`, (4 * ei) / length);
    bars.text(r2, 7, "2EI/L");
    bars.formula(r2, 8, `2*${E}*${I}/${L}`, (2 * ei) / length);
    const c = address(r1, 4);
    const s = address(r1, 6);
    const ea = address(r1, 8);
    const k12 = address(r2, 2);
    const k6 = address(r2, 4);
    const k4 = address(r2, 6);
    const k2 = address(r2, 8);

    const labelsRow = top + 3;
    const matrixTop = top + 5;
    const localLabels = [...LOCAL.map((d) => `${from.name} ${d}`), ...LOCAL.map((d) => `${to.name} ${d}`)];
    const globalLabels = [...AXES.map((d) => `${from.name} ${d}`), ...AXES.map((d) => `${to.name} ${d}`)];

    /** Una matriz de 6×6 celda por celda, con su rótulo de filas a la izquierda. */
    const matrix = (left: number, title: string, formulas: string[][], values: number[][], rowLabels: string[]) => {
      bars.text(labelsRow, left, title, "label");
      for (let r = 0; r < 6; r++) {
        bars.text(matrixTop + r, left, rowLabels[r], "label");
        for (let col = 0; col < 6; col++) {
          const formula = formulas[r][col];
          if (formula === "0" || formula === "1") bars.set(matrixTop + r, left + 1 + col, { role: "computed", value: Number(formula) });
          else bars.formula(matrixTop + r, left + 1 + col, formula, values[r][col]);
        }
      }
      return rangeAddress(matrixTop, left + 1, 6, 6);
    };

    // T: gira las traslaciones de cada extremo y deja el giro.
    const T = matrix(
      1,
      "T (transformación)",
      [
        [c, s, "0", "0", "0", "0"],
        [`-${s}`, c, "0", "0", "0", "0"],
        ["0", "0", "1", "0", "0", "0"],
        ["0", "0", "0", c, s, "0"],
        ["0", "0", "0", `-${s}`, c, "0"],
        ["0", "0", "0", "0", "0", "1"],
      ],
      frame.transform(),
      localLabels,
    );
    const k = matrix(
      8,
      "k (local)",
      [
        [ea, "0", "0", `-${ea}`, "0", "0"],
        ["0", k12, k6, "0", `-${k12}`, k6],
        ["0", k6, k4, "0", `-${k6}`, k2],
        [`-${ea}`, "0", "0", ea, "0", "0"],
        ["0", `-${k12}`, `-${k6}`, "0", k12, `-${k6}`],
        ["0", k6, k2, "0", `-${k6}`, k4],
      ],
      frame.localStiffness(),
      localLabels,
    );

    // K de la barra = Tᵀ·k·T, con los grados globales a los que va cada fila.
    const keCol = 16;
    const step = stepByElement.get(element.id)!;
    bars.text(labelsRow, keCol - 1, "K de la barra = Tᵀ · k · T (a qué posición de K va cada fila y columna)", "label");
    step.dofs.forEach((g, j) => {
      bars.text(matrixTop - 1, keCol + j, `${globalLabels[j]} → ${g}`, "header");
      bars.text(matrixTop + j, keCol - 1, `${globalLabels[j]} → ${g}`, "label");
    });
    bars.array(matrixTop, keCol, `MMULT(MMULT(TRANSPOSE(${T}),${k}),${T})`, frame.stiffness());

    // El FEM de la barra: la suma de sus cargas, o el escrito a mano; y en globales.
    const femTop = matrixTop + 7;
    bars.text(femTop - 1, 1, element.manualFem ? "FEM local (a mano, hoja Datos)" : "FEM local (suma de sus cargas)", "label");
    const elementFemValues = element.manualFem
      ? manualFem(element)
      : (loadFemRefs.get(element.id) ?? []).length > 0
        ? usableLoads
            .filter((l) => l.elementId === element.id)
            .map((l) => femVector(loadFixedEndForces(toMemberLoad(l, length), axis)))
            .reduce((sum, v) => sum.map((x, i) => x + v[i]), [0, 0, 0, 0, 0, 0])
        : [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6; i++) {
      bars.text(femTop + i, 1, localLabels[i], "label");
      if (element.manualFem) bars.formula(femTop + i, 2, data.ref(dataRow, 8 + i), elementFemValues[i]);
      else {
        const refs = (loadFemRefs.get(element.id) ?? []).map((r) => r[i]);
        if (refs.length > 0) bars.formula(femTop + i, 2, refs.join("+"), elementFemValues[i]);
        else bars.set(femTop + i, 2, { role: "computed", value: 0 });
      }
    }
    const femLocal = rangeAddress(femTop, 2, 6, 1);
    bars.text(femTop - 1, 4, "FEM global = Tᵀ · FEM", "label");
    globalLabels.forEach((label, i) => bars.text(femTop + i, 4, label, "label"));
    const t = frame.transform();
    const femGlobalValues = t.map((_, col) => t.reduce((sum, row, r) => sum + row[col] * elementFemValues[r], 0));
    bars.array(femTop, 5, `MMULT(TRANSPOSE(${T}),${femLocal})`, femGlobalValues.map((v) => [v]));

    barRefs.set(element.id, {
      length: bars.ref(r1, 2),
      cos: bars.ref(r1, 4),
      sin: bars.ref(r1, 6),
      stiffness: (r, col) => bars.ref(matrixTop + r, keCol + col),
      transform: bars.rangeRef(matrixTop, 2, 6, 6),
      local: bars.rangeRef(matrixTop, 9, 6, 6),
      femLocal: bars.rangeRef(femTop, 2, 6, 1),
      femGlobal: (i) => bars.ref(femTop + i, 5),
    });
  });
  for (let col = 1; col <= 21; col++) bars.width(col, 12);
  bars.width(15, 14);

  // -------------------------------------------- Ensamblaje y Solución (comunes)
  const { assembly, solution, ufRef, rrRef, femVectorRef } = buildMatrixMethodSheets({
    solved,
    dofLabel,
    elementIds: elements.map((e) => e.id),
    stiffnessRef: (id, i, j) => barRefs.get(id)!.stiffness(i, j),
    force: (g) => {
      const entry = dofOrder[g];
      return {
        ref: nodeRefs.get(entry.nodeId)!.force[entry.localDof]!,
        value: forces(nodesById.get(entry.nodeId)!)[entry.localDof],
      };
    },
    prescribedRef: (g) => {
      const entry = dofOrder[g];
      return nodeRefs.get(entry.nodeId)!.displacement[entry.localDof]!;
    },
    assemblyNote:
      "Cada celda suma lo que aporta cada barra que toca los dos nudos de su fila y su columna. La columna FEM suma, igual, el FEM de las barras en ejes globales.",
    // Siempre, aunque hoy sea cero: si en el libro se le pone valor a una
    // carga, el término tiene que existir para recibirlo.
    femRef: (id, i) => barRefs.get(id)!.femGlobal(i),
  });

  // ---------------------------------------------------------------- Resultados
  const results = new SheetBuilder(FRAME_2D_SHEETS.results);
  results.text(1, 1, "Resultados", "title");
  ["Nudo", "Desplazamiento X", "Desplazamiento Z", "Giro", "Reacción X", "Reacción Z", "Momento de reacción"].forEach(
    (title, i) => results.text(3, 1 + i, title, "header"),
  );
  const globalIndexOf = new Map(dofOrder.map((e) => [`${e.nodeId}:${e.localDof}`, e.globalIndex]));
  const displacementRef = new Map<string, string>();
  const reactionRef = new Map<string, string>();
  nodes.forEach((node, i) => {
    const row = 4 + i;
    const restrained = restraints(node);
    results.text(row, 1, node.name, "fixed");
    AXES.forEach((_, d) => {
      const g = globalIndexOf.get(`${node.id}:${d}`)!;
      const source = restrained[d] ? nodeRefs.get(node.id)!.displacement[d]! : ufRef.get(g)!;
      results.formula(row, 2 + d, source, solved.displacements.get(node.id)![d]);
      displacementRef.set(`${node.id}:${d}`, results.ref(row, 2 + d));
      if (restrained[d]) {
        results.formula(row, 5 + d, rrRef.get(g)!, solved.reactions.get(node.id)![d]);
        reactionRef.set(`${node.id}:${d}`, results.ref(row, 5 + d));
      } else results.text(row, 5 + d, NOT_APPLICABLE, "fixed");
    });
  });

  // Las fuerzas de extremo: f = k·T·u + FEM, en ejes locales; y los esfuerzos
  // en la convención de viga (N tracción +, V horario +, M + si tracciona abajo).
  const forcesTop = 4 + nodes.length + 2;
  results.text(forcesTop, 1, "Fuerzas de extremo de cada barra", "subtitle");
  results.text(
    forcesTop + 1,
    1,
    "f = k · T · u + FEM, en ejes locales (lo que los nudos le hacen a la barra). N, V y M son los esfuerzos en la convención de viga: N positiva en tracción, V positivo si hace girar el tramo en sentido horario, M positivo si tracciona la fibra de abajo.",
    "note",
  );
  results.merge(forcesTop + 1, 1, 1, 8);
  const headerRow = forcesTop + 2;
  ["Barra / extremo", "u global", "f local", "", "N", "V", "M"].forEach((title, i) =>
    title ? results.text(headerRow, 1 + i, title, "header") : undefined,
  );
  elements.forEach((element, index) => {
    const top = headerRow + 1 + index * 7;
    const refs = barRefs.get(element.id)!;
    const from = nodesById.get(element.fromNodeId)!;
    const to = nodesById.get(element.toNodeId)!;
    const internal = solved.internalForces.get(element.id) as FrameInternalForce;
    results.text(top, 1, element.name, "subtitle");
    const u = [
      ...[0, 1, 2].map((d) => displacementRef.get(`${from.id}:${d}`)!),
      ...[0, 1, 2].map((d) => displacementRef.get(`${to.id}:${d}`)!),
    ];
    const uValues = [...solved.displacements.get(from.id)!, ...solved.displacements.get(to.id)!];
    const labels = [...AXES.map((d) => `${from.name} ${d}`), ...AXES.map((d) => `${to.name} ${d}`)];
    labels.forEach((label, i) => {
      results.text(top + 1 + i, 1, label, "label");
      results.formula(top + 1 + i, 2, u[i], uValues[i]);
    });
    const f = [
      internal.from.axial,
      internal.from.shear,
      internal.from.moment,
      internal.to.axial,
      internal.to.shear,
      internal.to.moment,
    ];
    results.array(
      top + 1,
      3,
      `MMULT(${refs.local},MMULT(${refs.transform},${rangeAddress(top + 1, 2, 6, 1)}))+${refs.femLocal}`,
      f.map((v) => [v]),
    );
    // Convención de viga en cada extremo: desde (N = −f₁, V = f₂, M = −f₃),
    // hacia (N = f₄, V = −f₅, M = f₆).
    const fRef = (i: number) => address(top + 1 + i, 3);
    results.text(top + 1, 4, `desde (${from.name})`, "label");
    results.formula(top + 1, 5, `-${fRef(0)}`, -f[0]);
    results.formula(top + 1, 6, fRef(1), f[1]);
    results.formula(top + 1, 7, `-${fRef(2)}`, -f[2]);
    results.text(top + 4, 4, `hacia (${to.name})`, "label");
    results.formula(top + 4, 5, fRef(3), f[3]);
    results.formula(top + 4, 6, `-${fRef(4)}`, -f[4]);
    results.formula(top + 4, 7, fRef(5), f[5]);
  });

  // El equilibrio global: cargas de los nudos, de las barras (por su carga
  // nodal equivalente, −FEM global) y reacciones; los momentos, respecto del
  // origen, con brazos de palanca.
  const checkTop = headerRow + 1 + elements.length * 7 + 1;
  results.text(checkTop, 1, "Control de equilibrio global: todas las cargas + reacciones, tiene que dar 0", "subtitle");
  const externalRef = (node: Frame2DNodeInput, d: number) => {
    const g = globalIndexOf.get(`${node.id}:${d}`)!;
    const own = restraints(node)[d] ? reactionRef.get(`${node.id}:${d}`)! : nodeRefs.get(node.id)!.force[d]!;
    return `(${own}-${femVectorRef.get(g)!})`;
  };
  const externalValue = (node: Frame2DNodeInput, d: number) => {
    const g = globalIndexOf.get(`${node.id}:${d}`)!;
    const own = restraints(node)[d] ? solved.reactions.get(node.id)![d] : forces(node)[d];
    return own - solved.assembly.fixedEndForces[g];
  };
  const sumX = nodes.map((n) => externalRef(n, 0)).join("+");
  const sumZ = nodes.map((n) => externalRef(n, 1)).join("+");
  const sumM = nodes
    .map((n) => {
      const [x, z] = nodeRefs.get(n.id)!.coordinates;
      return `${externalRef(n, 2)}+${x}*${externalRef(n, 1)}-${z}*${externalRef(n, 0)}`;
    })
    .join("+");
  const valueX = nodes.reduce((sum, n) => sum + externalValue(n, 0), 0);
  const valueZ = nodes.reduce((sum, n) => sum + externalValue(n, 1), 0);
  const valueM = nodes.reduce(
    (sum, n) => sum + externalValue(n, 2) + n.x * externalValue(n, 1) - n.z * externalValue(n, 0),
    0,
  );
  results.text(checkTop + 1, 1, "Suma X", "label");
  results.formula(checkTop + 1, 2, sumX, valueX);
  results.text(checkTop + 2, 1, "Suma Z", "label");
  results.formula(checkTop + 2, 2, sumZ, valueZ);
  results.text(checkTop + 3, 1, "Suma M (origen)", "label");
  results.formula(checkTop + 3, 2, sumM, valueM);
  results.width(1, 16);
  for (let col = 2; col <= 7; col++) results.width(col, 16);

  return { sheets: [data.sheet, loadSheet.sheet, bars.sheet, assembly, solution, results.sheet] };
}
