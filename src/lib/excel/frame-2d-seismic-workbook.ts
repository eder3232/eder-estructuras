import { inv, multiply } from "mathjs";

import {
  MIN_C_OVER_R,
  heightExponent,
  staticAmplificationFactor,
  staticSeismicForces,
  storyDrifts,
  type FrameEndForcePair,
  type LoadCombination,
} from "@/lib/engine";
import { SheetBuilder, address, rangeAddress, type WorkbookModel } from "./workbook-model";

/**
 * El libro de Excel de `frame2d-seismic`, **con el sismo vivo**. Tres hojas
 * (alcance acordado el 2026-10-17, `docs/frame2d-seismic-v1.md`, paso 8):
 *
 * - **Sismo**: los parámetros de la E.030, las alturas y los pesos son celdas
 *   editables; R, C (con la regla 18.3 del estático), C/R con su mínimo, V,
 *   el V de derivas, k, αᵢ y Fᵢ son fórmulas.
 * - **Rigidez lateral**: las cuatro partes de `K_ff` son **fijas** —las decide
 *   la geometría, que se edita en la app—, y `K_L`, `δ = K_L⁻¹·F` (con las F
 *   vivas de la hoja Sismo) y las derivas son fórmulas: editar Z o un peso
 *   cambia las derivas.
 * - **Combinaciones**: las fuerzas de extremo y las reacciones de cada caso
 *   son **fijas** (las resolvió la app); los factores se editan, y las
 *   combinaciones y la envolvente de los extremos son fórmulas.
 *
 * El procedimiento matricial de cada caso es el del libro de Pórticos 2D: acá
 * no se repite.
 */

export interface SeismicWorkbookParams {
  Z: number;
  U: number;
  S: number;
  TP: number;
  TL: number;
  R0: number;
  Ia: number;
  Ip: number;
  periodMode: "height" | "manual";
  CT: number;
  T: number;
  forceMode: "e030" | "manual";
  regular: boolean;
  driftLimit: number;
}

export interface SeismicWorkbookLevel {
  name: string;
  /** Los nudos del nivel, ya escritos («v3, v4»). */
  nodes: string;
  height: number;
  weight: number;
  /** Solo con `forceMode: "manual"`. */
  manualForce: number;
}

export interface SeismicWorkbookInput {
  params: SeismicWorkbookParams;
  /** De abajo hacia arriba. */
  levels: SeismicWorkbookLevel[];
  /** La condensación de `K_ff` del caso CS, con el rótulo de cada grado. */
  lateral: { kaa: number[][]; kab: number[][]; kbb: number[][]; kept: string[]; dropped: string[] };
  combinations: LoadCombination[];
  /** Las fuerzas de extremo de cada barra en cada caso, en la convención del motor. */
  elements: { name: string; from: string; to: string; endForces: Record<CaseKey, FrameEndForcePair> }[];
  /** Las reacciones de cada apoyo en cada caso: [Rx, Rz, M]. */
  supports: { name: string; reactions: Record<CaseKey, number[]> }[];
}

type CaseKey = "CM" | "CV" | "CS";
const CASE_KEYS: CaseKey[] = ["CM", "CV", "CS"];

export const SEISMIC_SHEETS = {
  seismic: "Sismo",
  lateral: "Rigidez lateral",
  combinations: "Combinaciones",
} as const;

/** Lo que el libro tiene que dar, con las mismas funciones del motor que usa la app. */
function expected(input: SeismicWorkbookInput) {
  const { params, levels } = input;
  const R = params.R0 * params.Ia * params.Ip;
  const hn = levels[levels.length - 1].height;
  const T = params.periodMode === "height" ? hn / params.CT : params.T;
  if (params.forceMode === "manual") {
    return { R, hn, T, forces: levels.map((l) => l.manualForce), driftScale: 1, detail: null, C: 0 };
  }
  const C = staticAmplificationFactor(T, params.TP, params.TL).C;
  const detail = staticSeismicForces({
    Z: params.Z,
    U: params.U,
    S: params.S,
    R,
    C,
    T,
    levels: levels.map((l) => ({ height: l.height, weight: l.weight })),
  });
  return {
    R,
    hn,
    T,
    C,
    detail,
    forces: detail.levels.map((l) => l.force),
    driftScale: detail.driftBaseShear / detail.baseShear,
  };
}

/** Los tres esfuerzos de cada extremo en la convención de viga, como en las tablas de la app. */
function beamEnds(pair: FrameEndForcePair): number[] {
  return [
    -pair.from.axial,
    pair.from.shear,
    -pair.from.moment,
    pair.to.axial,
    -pair.to.shear,
    pair.to.moment,
  ];
}

export function buildSeismicWorkbook(input: SeismicWorkbookInput): WorkbookModel {
  const { params, levels, lateral, combinations } = input;
  const want = expected(input);
  const n = levels.length;

  // ---------------------------------------------------------------- Sismo
  const seismic = new SheetBuilder(SEISMIC_SHEETS.seismic);
  seismic.text(1, 1, "Sismo — análisis estático de la E.030 (2026)", "title");
  const notes = [
    "Las celdas amarillas se pueden editar: los parámetros de la E.030, la altura y el peso de cada nivel. Todo lo demás son fórmulas y se recalcula solo, también en la hoja Rigidez lateral.",
    "Los parámetros se eligen con la norma: Z por la zona (Tabla N° 1), S, TP y TL por el suelo (Tablas N° 4 y 5), U por la categoría (Tabla N° 7), R0 por el sistema estructural (Tabla N° 10). Para el cortante estático, C = 2.5 en todo T ≤ TP (artículo 18.3).",
    "Las fuerzas de cada caso y la matriz de rigidez vienen de la app: para cambiar la geometría o las cargas de gravedad, volvé a Eder Estructuras y generá otro Excel.",
  ];
  notes.forEach((note, i) => {
    seismic.text(2 + i, 1, note, "note");
    seismic.merge(2 + i, 1, 1, 9);
  });

  // Parámetros: rótulo en A, valor en B.
  const P_TOP = 2 + notes.length + 1;
  const paramRow: Record<string, number> = {};
  let row = P_TOP;
  const input_ = (key: string, label: string, value: number) => {
    seismic.text(row, 1, label);
    seismic.set(row, 2, { role: "input", value });
    paramRow[key] = row++;
  };
  const computed = (key: string, label: string, formula: string, value: number) => {
    seismic.text(row, 1, label);
    seismic.formula(row, 2, formula, value);
    paramRow[key] = row++;
  };
  const p = (key: string) => address(paramRow[key], 2);

  const e030 = params.forceMode === "e030";
  seismic.text(row++, 1, "Parámetros", "subtitle");
  if (e030) {
    input_("Z", "Z", params.Z);
    input_("U", "U", params.U);
    input_("S", "S", params.S);
    input_("TP", "TP (s)", params.TP);
    input_("TL", "TL (s)", params.TL);
  }
  input_("R0", "R0", params.R0);
  input_("Ia", "Ia", params.Ia);
  input_("Ip", "Ip", params.Ip);
  computed("R", "R = R0·Ia·Ip", `${p("R0")}*${p("Ia")}*${p("Ip")}`, want.R);

  // La tabla de niveles va debajo; sus rangos se conocen ya.
  const levelTop = row + (e030 ? 12 : 2);
  const L_COL = { name: 1, nodes: 2, height: 3, weight: 4, weighted: 5, alpha: 6, force: 7, driftForce: 8 } as const;
  const levelRange = (col: number) => rangeAddress(levelTop + 1, col, n, 1);
  const levelCell = (i: number, col: number) => address(levelTop + 1 + i, col);

  if (e030) {
    if (params.periodMode === "height") {
      computed("hn", "hn: la altura del nivel más alto", `MAX(${levelRange(L_COL.height)})`, want.hn);
      input_("CT", "CT", params.CT);
      computed("T", "T = hn / CT (s)", `${p("hn")}/${p("CT")}`, want.T);
    } else {
      input_("T", "T (s), escrito", params.T);
    }
    const T = p("T");
    computed(
      "C",
      "C (artículo 18; 2.5 si T ≤ TP)",
      `IF(${T}<=${p("TP")},2.5,IF(${T}<${p("TL")},2.5*${p("TP")}/${T},2.5*${p("TP")}*${p("TL")}/${T}^2))`,
      want.C,
    );
    computed("CR", "C/R", `${p("C")}/${p("R")}`, want.detail!.cOverR);
    computed("CRused", `C/R usado (mínimo ${MIN_C_OVER_R}, artículo 34.2)`, `MAX(${p("CR")},${MIN_C_OVER_R})`, Math.max(want.detail!.cOverR, MIN_C_OVER_R));
    computed("P", "P = Σ Pi", `SUM(${levelRange(L_COL.weight)})`, want.detail!.weight);
    computed("V", "V = Z·U·S·(C/R usado)·P", `${p("Z")}*${p("U")}*${p("S")}*${p("CRused")}*${p("P")}`, want.detail!.baseShear);
    computed("Vd", "V para derivas, sin el mínimo (50.3)", `${p("Z")}*${p("U")}*${p("S")}*${p("CR")}*${p("P")}`, want.detail!.driftBaseShear);
    computed("k", "k (artículo 35.2)", `IF(${T}<=0.5,1,MIN(0.75+0.5*${T},2))`, heightExponent(want.T));
    computed("scale", "V derivas / V", `${p("Vd")}/${p("V")}`, want.driftScale);
  } else {
    seismic.text(row, 1, "V derivas / V");
    seismic.set(row, 2, { role: "fixed", value: 1 });
    paramRow.scale = row++;
  }

  const levelTitles = e030
    ? ["Nivel", "Nudos", "hi", "Pi", "Pi·hi^k", "αi", "Fi", "Fi para derivas"]
    : ["Nivel", "Nudos", "hi", "Pi", "", "", "Fi (escrita)"];
  seismic.text(levelTop - 1, 1, "Niveles (de abajo hacia arriba)", "subtitle");
  levelTitles.forEach((title, i) => title && seismic.text(levelTop, 1 + i, title, "header"));
  const forceRef: string[] = [];
  levels.forEach((level, i) => {
    const r = levelTop + 1 + i;
    seismic.text(r, L_COL.name, level.name, "fixed");
    seismic.text(r, L_COL.nodes, level.nodes, "fixed");
    seismic.set(r, L_COL.height, { role: "input", value: level.height });
    seismic.set(r, L_COL.weight, { role: "input", value: level.weight });
    if (e030) {
      const d = want.detail!.levels[i];
      seismic.formula(r, L_COL.weighted, `${levelCell(i, L_COL.weight)}*${levelCell(i, L_COL.height)}^${p("k")}`, d.weightedHeight);
      seismic.formula(r, L_COL.alpha, `${levelCell(i, L_COL.weighted)}/SUM(${levelRange(L_COL.weighted)})`, d.alpha);
      seismic.formula(r, L_COL.force, `${levelCell(i, L_COL.alpha)}*${p("V")}`, d.force);
      seismic.formula(r, L_COL.driftForce, `${levelCell(i, L_COL.alpha)}*${p("Vd")}`, d.driftForce);
    } else {
      seismic.set(r, L_COL.force, { role: "input", value: level.manualForce });
    }
    forceRef.push(seismic.ref(r, L_COL.force));
  });
  seismic.width(1, 44);
  seismic.width(2, 14);
  for (let col = 3; col <= 8; col++) seismic.width(col, 14);

  // ---------------------------------------------------------------- Rigidez lateral
  const lat = new SheetBuilder(SEISMIC_SHEETS.lateral);
  lat.text(1, 1, "Rigidez lateral por condensación estática", "title");
  lat.text(
    2,
    1,
    "Kaa, Kab y Kbb son las partes de Kff (la del caso CS de la app) con a = la traslación de cada nivel y b = el resto de los grados libres. Son FIJAS: las decide la geometría. KL = Kaa − Kab·Kbb⁻¹·Kba (Kba = Kabᵀ, por simetría) y lo que sigue son fórmulas.",
    "note",
  );
  lat.merge(2, 1, 1, 12);
  const m = lateral.dropped.length;
  let top = 4;
  /** Una matriz fija con rótulos; devuelve el rango de sus valores. */
  const fixedMatrix = (title: string, values: number[][], rows: string[], cols: string[]) => {
    lat.text(top, 1, title, "subtitle");
    cols.forEach((label, j) => lat.text(top + 1, 2 + j, label, "header"));
    rows.forEach((label, i) => {
      lat.text(top + 2 + i, 1, label, "label");
      values[i].forEach((value, j) => lat.set(top + 2 + i, 2 + j, { role: "fixed", value }));
    });
    const range = rangeAddress(top + 2, 2, rows.length, cols.length);
    top += rows.length + 3;
    return range;
  };
  const kaa = fixedMatrix("Kaa", lateral.kaa, lateral.kept, lateral.kept);
  const kab = m > 0 ? fixedMatrix("Kab", lateral.kab, lateral.kept, lateral.dropped) : null;
  const kbb = m > 0 ? fixedMatrix("Kbb", lateral.kbb, lateral.dropped, lateral.dropped) : null;

  // Lo que tiene que dar KL, con la misma cuenta que la fórmula del libro.
  const correction =
    m > 0 ? (multiply(multiply(lateral.kab, inv(lateral.kbb)), transpose(lateral.kab)) as number[][]) : null;
  const kl = lateral.kaa.map((r, i) => r.map((v, j) => v - (correction ? correction[i][j] : 0)));
  lat.text(top, 1, "KL = Kaa − Kab · Kbb⁻¹ · Kabᵀ", "subtitle");
  const levelNames = levels.map((l) => l.name);
  levelNames.forEach((label, j) => lat.text(top + 1, 2 + j, label, "header"));
  levelNames.forEach((label, i) => lat.text(top + 2 + i, 1, label, "label"));
  lat.array(
    top + 2,
    2,
    kab && kbb ? `${kaa}-MMULT(MMULT(${kab},MINVERSE(${kbb})),TRANSPOSE(${kab}))` : kaa,
    kl,
  );
  const klRange = rangeAddress(top + 2, 2, n, n);
  top += n + 3;

  // δ = KL⁻¹·F, con las F vivas de la hoja Sismo.
  const delta = (multiply(inv(kl), want.forces.map((f) => [f])) as number[][]).map((r) => r[0]);
  const factor = (params.regular ? 0.75 : 0.85) * want.R;
  const drifts = storyDrifts({
    heights: levels.map((l) => l.height),
    displacements: delta.map((d) => d * want.driftScale),
    factor,
    limit: params.driftLimit,
  });

  lat.text(top, 1, "Desplazamientos laterales y derivas (E.030, artículos 50 y 51)", "subtitle");
  const factorRow = top + 1;
  lat.text(factorRow, 1, params.regular ? "Factor 0.75·R (regular)" : "Factor 0.85·R (irregular)");
  lat.formula(factorRow, 2, `${params.regular ? 0.75 : 0.85}*${seismic.ref(paramRow.R, 2)}`, factor);
  const limitRow = top + 2;
  lat.text(limitRow, 1, "Límite de Δ/h (Tabla N° 14)");
  lat.set(limitRow, 2, { role: "input", value: params.driftLimit });

  const D_TOP = top + 4;
  const D = { name: 1, force: 2, delta: 3, height: 4, story: 5, driftDelta: 6, inelastic: 7, drift: 8, ratio: 9, use: 10 } as const;
  ["Nivel", "Fi", "δ = KL⁻¹·F", "hi", "hei", "δ para derivas", "δ inelástico", "Δi", "Δi/hei", "Δ/h ÷ límite (≤ 1 cumple)"].forEach(
    (title, i) => lat.text(D_TOP, 1 + i, title, "header"),
  );
  const dCell = (i: number, col: number) => address(D_TOP + 1 + i, col);
  levels.forEach((level, i) => {
    const r = D_TOP + 1 + i;
    lat.text(r, D.name, level.name, "fixed");
    lat.formula(r, D.force, forceRef[i], want.forces[i]);
    lat.formula(r, D.height, seismic.ref(levelTop + 1 + i, L_COL.height), level.height);
    lat.formula(
      r,
      D.story,
      i === 0 ? dCell(i, D.height) : `${dCell(i, D.height)}-${dCell(i - 1, D.height)}`,
      drifts[i].storyHeight,
    );
    lat.formula(r, D.driftDelta, `${dCell(i, D.delta)}*${seismic.ref(paramRow.scale, 2)}`, drifts[i].elastic);
    lat.formula(r, D.inelastic, `${dCell(i, D.driftDelta)}*${address(factorRow, 2)}`, drifts[i].inelastic);
    lat.formula(
      r,
      D.drift,
      i === 0 ? dCell(i, D.inelastic) : `${dCell(i, D.inelastic)}-${dCell(i - 1, D.inelastic)}`,
      drifts[i].drift,
    );
    lat.formula(r, D.ratio, `ABS(${dCell(i, D.drift)})/${dCell(i, D.story)}`, drifts[i].ratio);
    lat.formula(r, D.use, `${dCell(i, D.ratio)}/${address(limitRow, 2)}`, drifts[i].ratio / params.driftLimit);
  });
  lat.array(D_TOP + 1, D.delta, `MMULT(MINVERSE(${klRange}),${rangeAddress(D_TOP + 1, D.force, n, 1)})`, delta.map((d) => [d]));
  lat.width(1, 30);
  // Hasta la última columna de Kbb: en el ejemplo de tres pisos es de 18×18 y,
  // con el ancho fijo hasta la 12, las demás quedaban angostas (mirado en el PDF).
  for (let col = 2; col <= Math.max(12, 1 + m); col++) lat.width(col, 14);

  // ---------------------------------------------------------------- Combinaciones
  const comb = new SheetBuilder(SEISMIC_SHEETS.combinations);
  comb.text(1, 1, "Combinaciones de carga y envolvente", "title");
  comb.text(
    2,
    1,
    "Los factores son editables (por defecto, E.060 artículo 9.2; CS positivo es el sismo hacia +X). Los esfuerzos de cada caso son FIJOS: los resolvió la app. Cada combinación es la suma de los casos por sus factores, y la envolvente, el máximo y el mínimo entre todas. N positiva en tracción, V positivo si hace girar el tramo en sentido horario, M positivo si tracciona la fibra de abajo.",
    "note",
  );
  comb.merge(2, 1, 1, 12);
  const F_TOP = 4;
  comb.text(F_TOP, 1, "Combinación", "header");
  CASE_KEYS.forEach((c, j) => comb.text(F_TOP, 2 + j, c, "header"));
  const factorRef = combinations.map((combination, i) => {
    const r = F_TOP + 1 + i;
    comb.text(r, 1, combination.name, "fixed");
    CASE_KEYS.forEach((c, j) => comb.set(r, 2 + j, { role: "input", value: combination.factors[c] ?? 0 }));
    return (c: CaseKey) => address(r, 2 + CASE_KEYS.indexOf(c));
  });
  const factorValue = (i: number, c: CaseKey) => combinations[i].factors[c] ?? 0;

  // Columnas de los bloques: rótulo, los tres casos, una por combinación, máx y mín.
  const C_CASE = 3;
  const C_COMB = C_CASE + 3;
  const C_MAX = C_COMB + combinations.length;
  const header = (r: number) => {
    CASE_KEYS.forEach((c, j) => comb.text(r, C_CASE + j, c, "header"));
    combinations.forEach((c, j) => comb.text(r, C_COMB + j, c.name, "header"));
    comb.text(r, C_MAX, "Máximo", "header");
    comb.text(r, C_MAX + 1, "Mínimo", "header");
  };
  /** Una fila: los casos fijos, cada combinación como fórmula, y la envolvente. */
  const line = (r: number, label: string, byCase: Record<CaseKey, number>) => {
    comb.text(r, 2, label, "label");
    CASE_KEYS.forEach((c, j) => comb.set(r, C_CASE + j, { role: "fixed", value: byCase[c] }));
    const values = combinations.map((_, i) => CASE_KEYS.reduce((sum, c) => sum + factorValue(i, c) * byCase[c], 0));
    combinations.forEach((_, i) => {
      const formula = CASE_KEYS.map((c, j) => `${factorRef[i](c)}*${address(r, C_CASE + j)}`).join("+");
      comb.formula(r, C_COMB + i, formula, values[i]);
    });
    if (combinations.length > 0) {
      const range = rangeAddress(r, C_COMB, 1, combinations.length);
      comb.formula(r, C_MAX, `MAX(${range})`, Math.max(...values));
      comb.formula(r, C_MAX + 1, `MIN(${range})`, Math.min(...values));
    }
  };

  row = F_TOP + combinations.length + 2;
  comb.text(row++, 1, "Esfuerzos en los extremos de cada barra", "subtitle");
  const ENDS = ["N desde", "V desde", "M desde", "N hacia", "V hacia", "M hacia"];
  for (const element of input.elements) {
    comb.text(row, 1, `${element.name} (${element.from} → ${element.to})`, "fixed");
    header(row);
    const byCase = Object.fromEntries(CASE_KEYS.map((c) => [c, beamEnds(element.endForces[c])])) as Record<CaseKey, number[]>;
    ENDS.forEach((label, k) => line(row + 1 + k, label, { CM: byCase.CM[k], CV: byCase.CV[k], CS: byCase.CS[k] }));
    row += ENDS.length + 2;
  }

  comb.text(row++, 1, "Reacciones de cada apoyo", "subtitle");
  for (const support of input.supports) {
    comb.text(row, 1, support.name, "fixed");
    header(row);
    ["Rx", "Rz", "M"].forEach((label, k) =>
      line(row + 1 + k, label, { CM: support.reactions.CM[k], CV: support.reactions.CV[k], CS: support.reactions.CS[k] }),
    );
    row += 5;
  }
  comb.width(1, 24);
  comb.width(2, 12);
  for (let col = 3; col <= C_MAX + 1; col++) comb.width(col, 16);

  return { sheets: [seismic.sheet, lat.sheet, comb.sheet] };
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, j) => matrix.map((row) => row[j]));
}
