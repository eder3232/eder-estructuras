import type { FrameFixedEndForces } from "./frame-element-2d";
import { memberDiagram } from "./member-diagrams";
import type { MemberAxis, MemberLoad } from "./member-loads";

/** Desplazamiento de un punto de la barra, en sus ejes locales: `u` sobre `x'`, `v` sobre `y'`. */
export interface DeflectionPoint {
  x: number;
  u: number;
  v: number;
}

export interface MemberDeflection {
  points: DeflectionPoint[];
  /**
   * Lo que la parte particular da en «hacia» (`v`, `v'` y `u`). Tiene que ser
   * ~0: es la flecha de una barra biempotrada, que en sus extremos no se mueve
   * ni gira. Si no da cero, el FEM y las cargas no son de la misma barra.
   */
  closure: { u: number; v: number; slope: number };
}

/** Gauss–Legendre de 3 puntos en [0, 1]: exacto hasta grado 5. */
const GAUSS_3 = [
  { t: 0.5 - Math.sqrt(15) / 10, w: 5 / 18 },
  { t: 0.5, w: 8 / 18 },
  { t: 0.5 + Math.sqrt(15) / 10, w: 5 / 18 },
];

/**
 * La forma deformada de una barra de pórtico, **entre** sus nudos.
 *
 * Moviendo solo los extremos —una recta entre nudos desplazados, lo que había
 * hasta acá (D3 de `docs/refactor-roadmap.md`)— un empotramiento se dibujaba
 * girado, como si fuera una articulación. Y tampoco alcanza con interpolar los
 * extremos con Hermite: una viga biempotrada con carga repartida tiene los dos
 * giros en cero y aun así se flecta. La deformada es la suma de dos partes:
 *
 * - **Homogénea**: Hermite con los desplazamientos y giros de los extremos
 *   (lineal para `u`). Es lo que la barra hace por moverse sus nudos.
 * - **Particular**: la flecha de la misma barra **biempotrada** bajo su carga.
 *   Sale de integrar dos veces `EI·v'' = M`, con `M` el diagrama de esa barra
 *   biempotrada — que es el de `memberDiagram` con el FEM como fuerzas de
 *   extremo, porque eso es el FEM. Con `v(0) = v'(0) = 0` la integral queda
 *   determinada, y `v(L) = v'(L) = 0` tiene que salir solo (`closure`).
 *
 * **La integral es exacta**, aunque se haga con cuadratura: entre dos puntos
 * del diagrama `M` es a lo sumo una cúbica (los puntos ya incluyen todos los
 * bordes de carga), así que Gauss de 3 puntos integra `θ = ∫M/EI` sin error, y
 * también `v`, escrita como `v₁ = v₀ + θ₀·h + ∫(x₁ − s)·M/EI ds` (grado 4). La
 * primera versión usaba trapecios y erraba en la quinta cifra: los tests contra
 * las flechas de los libros la dejaron afuera.
 */
export function memberDeflection({
  axis,
  localEnds,
  fixedEndForces,
  loads,
  ea,
  ei,
}: {
  axis: MemberAxis;
  /** `[u_i, v_i, θ_i, u_j, v_j, θ_j]` en ejes locales: `T · u_global`. */
  localEnds: readonly number[];
  fixedEndForces: FrameFixedEndForces;
  loads: readonly MemberLoad[];
  ea: number;
  ei: number;
}): MemberDeflection {
  const { length: L } = axis;
  const [ui, vi, ti, uj, vj, tj] = localEnds;
  const fixed = memberDiagram(fixedEndForces, loads, axis);

  // Desde x = 0 con v = v' = u = 0, intervalo por intervalo entre los puntos
  // del diagrama. En un salto hay dos puntos con el mismo x: ahí no se integra.
  let slope = 0;
  let v = 0;
  let u = 0;
  const particular: { x: number; u: number; v: number }[] = [];
  fixed.points.forEach((p, k) => {
    const prev = fixed.points[k - 1];
    const h = prev ? p.x - prev.x : 0;
    if (prev && h > 0) {
      let dSlope = 0;
      let dV = 0;
      let dU = 0;
      for (const { t, w } of GAUSS_3) {
        const s = prev.x + h * t;
        const value = fixed.at(s);
        dSlope += w * h * (value.M / ei);
        dV += w * h * ((p.x - s) * value.M) / ei;
        dU += w * h * (value.N / ea);
      }
      v += slope * h + dV;
      slope += dSlope;
      u += dU;
    }
    particular.push({ x: p.x, u, v });
  });

  const points = particular.map((p) => {
    const xi = p.x / L;
    const h1 = 1 - 3 * xi ** 2 + 2 * xi ** 3;
    const h2 = L * (xi - 2 * xi ** 2 + xi ** 3);
    const h3 = 3 * xi ** 2 - 2 * xi ** 3;
    const h4 = L * (-(xi ** 2) + xi ** 3);
    return {
      x: p.x,
      u: (1 - xi) * ui + xi * uj + p.u,
      v: h1 * vi + h2 * ti + h3 * vj + h4 * tj + p.v,
    };
  });

  const last = particular[particular.length - 1];
  return { points, closure: { u: last.u, v: last.v, slope } };
}
