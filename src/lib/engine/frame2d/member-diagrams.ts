import type { FrameEndForcePair } from "./frame-element-2d";
import { lengthFactor, localDirection, type MemberAxis, type MemberLoad } from "./member-loads";

/**
 * Diagramas de fuerza axial, corte y momento a lo largo de una barra de
 * pórtico, **exactos**: por estática del tramo libre `[0, x]`, con las fuerzas
 * del extremo «desde» que dio el motor y las cargas que caen en ese tramo.
 *
 * El original integraba con 50 pasos de Riemann, empezaba corrido un paso,
 * nunca llegaba a `x = L`, se olvidaba de cargas según el diagrama y aplicaba
 * los momentos concentrados con las banderas de las cargas puntuales (V7–V12
 * de `docs/frame2d-v1.md`). Acá no se integra nada: con cargas lineales los
 * diagramas son polinomios por tramos y se evalúan en forma cerrada.
 *
 * **Convención (la de Hibbeler y Beer, aplicada a cada barra mirada de
 * «desde» a «hacia», con `y'` arriba):**
 * - `N` positiva en tracción.
 * - `V` positivo si hace girar el tramo en sentido horario.
 * - `M` positivo si tracciona la fibra del lado `−y'` («abajo»). Se cumple
 *   `dM/dx = V`.
 *
 * Las fuerzas de extremo del motor están en otra convención —la del elemento:
 * fuerza **sobre** la barra, positiva según los ejes locales, momento
 * antihorario—. La conversión es `V(0⁺) = F_i,y'`, `M(0⁺) = −M_i` y
 * `N(0⁺) = −F_i,x'`; en el otro extremo, `V(L⁻) = −F_j,y'`, `M(L⁻) = M_j` y
 * `N(L⁻) = F_j,x'`. Que el diagrama llegue ahí (`closure`) es la prueba de
 * que cargas, FEM y solución son coherentes.
 */
export interface DiagramValues {
  N: number;
  V: number;
  M: number;
}

export interface DiagramPoint extends DiagramValues {
  x: number;
}

/** Un punto donde vale la pena poner un número: extremos, saltos y máximos de M. */
export interface DiagramKeyPoint {
  x: number;
  kind: "end" | "jump" | "extremum";
  /** A la izquierda del punto (igual a `right` si no hay salto). */
  left: DiagramValues;
  right: DiagramValues;
}

export interface MemberDiagram {
  length: number;
  /** Ordenados por `x`. En un salto hay dos puntos con el mismo `x`: el de la izquierda primero. */
  points: DiagramPoint[];
  keyPoints: DiagramKeyPoint[];
  /** Lo que el diagrama da en `x = L` menos lo que dio el motor en «hacia». Tiene que ser ~0. */
  closure: DiagramValues;
  /** El valor exacto en cualquier `x` de la barra (a la derecha, si cae en un salto): lo usa el cursor. */
  at: (x: number) => DiagramValues;
}

/** Una carga ya reducida a ejes locales y por metro de barra. */
type LocalLoad =
  | { kind: "point"; a: number; px: number; py: number }
  | { kind: "moment"; a: number; m: number }
  | { kind: "distributed"; a: number; b: number; ux: number; uy: number; q1: number; q2: number };

function toLocal(load: MemberLoad, axis: MemberAxis): LocalLoad {
  if (load.kind === "moment") return { kind: "moment", a: load.a, m: load.value };
  const [ux, uy] = localDirection(load.direction, axis);
  if (load.kind === "point") return { kind: "point", a: load.a, px: ux * load.value, py: uy * load.value };
  const factor = lengthFactor(load, axis);
  return { kind: "distributed", a: load.a, b: load.b, ux, uy, q1: factor * load.q1, q2: factor * load.q2 };
}

/**
 * Lo que las cargas en `[0, x]` aportan: fuerza en `x'` y en `y'`, y momento
 * respecto del punto de corte (antihorario +). `side` decide qué pasa con una
 * carga concentrada **justo** en `x`: a la izquierda no cuenta, a la derecha sí.
 */
function loadsUpTo(loads: LocalLoad[], x: number, side: "left" | "right") {
  let fx = 0;
  let fy = 0;
  let moment = 0;
  const reached = (a: number) => a < x || (a === x && side === "right");

  for (const load of loads) {
    if (load.kind === "point") {
      if (!reached(load.a)) continue;
      fx += load.px;
      fy += load.py;
      // Una fuerza en `s` hacia `+y'`, vista desde el corte en `x > s`, gira en sentido horario.
      moment -= load.py * (x - load.a);
    } else if (load.kind === "moment") {
      if (reached(load.a)) moment += load.m;
    } else {
      const t = Math.min(x, load.b);
      if (t <= load.a) continue;
      // q(s) = q1 + k(s − a): las dos integrales en forma cerrada.
      const k = (load.q2 - load.q1) / (load.b - load.a);
      const span = t - load.a;
      const force = load.q1 * span + (k * span ** 2) / 2;
      const firstMoment = ((load.q1 - k * load.a) * (t ** 2 - load.a ** 2)) / 2 + (k * (t ** 3 - load.a ** 3)) / 3;
      fx += load.ux * force;
      fy += load.uy * force;
      // ∫ q(s)·(x − s) ds = x·∫q − ∫s·q
      moment -= load.uy * (x * force - firstMoment);
    }
  }
  return { fx, fy, moment };
}

function valuesAt(endForces: FrameEndForcePair, loads: LocalLoad[], x: number, side: "left" | "right"): DiagramValues {
  const { from } = endForces;
  const applied = loadsUpTo(loads, x, side);
  // Equilibrio del tramo [0, x]: las fuerzas de «desde», las cargas, y el
  // esfuerzo interno en el corte (N tirando hacia +x', V hacia −y', M antihorario).
  return {
    N: -(from.axial + applied.fx),
    V: from.shear + applied.fy,
    M: -from.moment + from.shear * x - applied.moment,
  };
}

/** Raíces reales de `A·x² + B·x + C` dentro de `(lo, hi)`. */
function rootsIn(A: number, B: number, C: number, lo: number, hi: number): number[] {
  const scale = Math.max(Math.abs(A), Math.abs(B), Math.abs(C), 1e-300);
  const roots: number[] = [];
  if (Math.abs(A) / scale < 1e-12) {
    if (Math.abs(B) / scale > 1e-12) roots.push(-C / B);
  } else {
    const disc = B * B - 4 * A * C;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      roots.push((-B - sq) / (2 * A), (-B + sq) / (2 * A));
    }
  }
  const margin = (hi - lo) * 1e-9;
  return roots.filter((r) => r > lo + margin && r < hi - margin);
}

/** Cuántos puntos por tramo para dibujar la curva: un tramo es a lo sumo una cúbica. */
const SAMPLES_PER_SPAN = 24;

export function memberDiagram(endForces: FrameEndForcePair, loads: readonly MemberLoad[], axis: MemberAxis): MemberDiagram {
  const { length } = axis;
  const local = loads.map((load) => toLocal(load, axis));

  // Los bordes de tramo: donde una carga empieza, termina o está aplicada.
  const breaks = [
    ...new Set([0, length, ...local.flatMap((l) => (l.kind === "distributed" ? [l.a, l.b] : [l.a]))]),
  ]
    .filter((x) => x >= 0 && x <= length)
    .sort((p, q) => p - q);

  const points: DiagramPoint[] = [];
  const keyPoints: DiagramKeyPoint[] = [];
  const at = (x: number, side: "left" | "right"): DiagramPoint => ({ x, ...valuesAt(endForces, local, x, side) });

  for (let i = 0; i < breaks.length; i++) {
    const x = breaks[i];
    const left = at(x, "left");
    const right = at(x, "right");
    const isEnd = i === 0 || i === breaks.length - 1;
    const jumps =
      Math.abs(left.N - right.N) + Math.abs(left.V - right.V) + Math.abs(left.M - right.M) >
      1e-9 * (1 + Math.abs(left.N) + Math.abs(left.V) + Math.abs(left.M));

    // En los extremos de la barra, el valor de afuera no existe: en x = 0 manda
    // la derecha, en x = L la izquierda.
    if (i === 0) points.push(right);
    else if (i === breaks.length - 1) points.push(left);
    else {
      points.push(left);
      if (jumps) points.push(right);
    }

    if (isEnd) {
      const value = i === 0 ? right : left;
      keyPoints.push({ x, kind: "end", left: strip(value), right: strip(value) });
    } else if (jumps) {
      keyPoints.push({ x, kind: "jump", left: strip(left), right: strip(right) });
    }

    if (i === breaks.length - 1) break;

    // Interior del tramo [x, next]: muestras para la curva, y los máximos de M
    // donde V = 0. V es a lo sumo cuadrático acá, así que tres puntos lo fijan.
    const next = breaks[i + 1];
    const h = next - x;
    const v0 = at(x, "right").V;
    const vm = at(x + h / 2, "right").V;
    const v1 = at(next, "left").V;
    // V(x + h·t) = v0 + (−3v0 + 4vm − v1)·t + (2v0 − 4vm + 2v1)·t²
    const A = 2 * v0 - 4 * vm + 2 * v1;
    const B = -3 * v0 + 4 * vm - v1;
    const extrema = rootsIn(A, B, v0, 0, 1).map((t) => x + h * t);

    const interior = [
      ...Array.from({ length: SAMPLES_PER_SPAN - 1 }, (_, k) => x + (h * (k + 1)) / SAMPLES_PER_SPAN),
      ...extrema,
    ].sort((p, q) => p - q);
    for (const s of interior) points.push(at(s, "right"));
    for (const s of extrema) {
      const value = strip(at(s, "right"));
      keyPoints.push({ x: s, kind: "extremum", left: value, right: value });
    }
  }

  const end = at(length, "left");
  const { to } = endForces;
  return {
    length,
    points,
    keyPoints: keyPoints.sort((p, q) => p.x - q.x),
    closure: { N: end.N - to.axial, V: end.V + to.shear, M: end.M - to.moment },
    at: (x) => valuesAt(endForces, local, Math.min(Math.max(x, 0), length), x >= length ? "left" : "right"),
  };
}

function strip({ N, V, M }: DiagramValues): DiagramValues {
  return { N, V, M };
}

/** Los esfuerzos de una barra en sus dos extremos, en la convención de viga (B8 de `docs/frame2d-v1.md`). */
export function beamConventionEnds(endForces: FrameEndForcePair): { from: DiagramValues; to: DiagramValues } {
  return {
    from: { N: -endForces.from.axial, V: endForces.from.shear, M: -endForces.from.moment },
    to: { N: endForces.to.axial, V: -endForces.to.shear, M: endForces.to.moment },
  };
}
