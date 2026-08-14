import type { Element } from "./element";

/** Lo que una barra le hace a uno de sus nudos, en direcciones globales. */
export interface NodeElementForce {
  elementId: string;
  force: number[];
}

export interface NodeEquilibrium {
  nodeId: string;
  /** Aporte de cada barra que llega, para poder mostrar de dónde sale la suma. */
  elements: NodeElementForce[];
  /** La suma de esos aportes. */
  fromElements: number[];
  /** La carga del usuario, más la carga nodal equivalente de las barras. */
  applied: number[];
  /** La reacción del apoyo — cero en los grados de libertad libres. */
  reaction: number[];
  /** `fromElements + applied + reaction`. Tiene que dar cero. */
  residual: number[];
}

export interface EquilibriumCheck {
  nodes: NodeEquilibrium[];
  /**
   * Cargas + reacciones de toda la estructura. Las barras **no** aparecen: cada
   * una tira de sus dos nudos con fuerzas iguales y opuestas, así que se
   * cancelan de a pares. Que esto dé cero es una comprobación distinta de la de
   * cada nudo — dice que cada matriz de rigidez está en equilibrio consigo
   * misma, no que el sistema se resolvió bien.
   */
  global: number[];
  /** El mayor `|residuo|` de todos, incluido el global. */
  maxResidual: number;
  /** La mayor fuerza en juego, que es contra lo que se juzga ese residuo. */
  scale: number;
  ok: boolean;
}

/**
 * Un residuo se juzga **relativo a las fuerzas en juego**: 10⁻⁶ es ruido de
 * redondeo en una estructura cargada con toneladas y es un error grosero en una
 * cargada con gramos.
 */
export const EQUILIBRIUM_TOLERANCE = 1e-6;

/** Piso absoluto, para el modelo sin ninguna carga: ahí no hay contra qué relativizar. */
const ABSOLUTE_FLOOR = 1e-9;

interface EquilibriumInput {
  dofPerNode: number;
  /** En el orden en que se van a mostrar: el de la tabla, no el de los DOF. */
  nodeIds: string[];
  elements: Element[];
  displacements: Map<string, number[]>;
  /** La carga que cargó el usuario, por nudo. */
  appliedForces: Map<string, number[]>;
  reactions: Map<string, number[]>;
}

/**
 * La verificación que cierra el método: **cada nudo tiene que estar en
 * equilibrio**. Las barras que llegan tiran de él, la carga lo empuja y el
 * apoyo lo sostiene; los tres tienen que sumar cero.
 *
 * Es la comprobación que el alumno hace a mano con el método de los nudos, y
 * la que hacían los scripts de regresión de este repo **fuera** de la app.
 *
 * **Por qué no es una tautología**, que es la objeción obvia: sí, `K·U = F` es
 * la ecuación que se resolvió. Pero acá el camino de ida es otro — se vuelve a
 * pasar por la rigidez de **cada barra** y por los desplazamientos ya
 * resueltos, sin usar la matriz global ni la partición—, así que un error de
 * ensamblaje, de mapeo de grados de libertad o de signo en la partición
 * aparece como un residuo que no cierra. Lo que **no** puede detectar es un
 * error dentro de `stiffness()` de la barra: eso mismo se usa de los dos lados.
 *
 * La fuerza que una barra ejerce sobre un nudo es `−(kₑ·uₑ)` en el bloque de
 * ese nudo: `kₑ·uₑ` son las fuerzas que hacen falta **sobre la barra** para
 * mantenerla deformada, y sobre el nudo actúan cambiadas de signo.
 */
export function equilibriumCheck({
  dofPerNode,
  nodeIds,
  elements,
  displacements,
  appliedForces,
  reactions,
}: EquilibriumInput): EquilibriumCheck {
  const zeros = () => new Array<number>(dofPerNode).fill(0);
  const fromElements = new Map(nodeIds.map((id) => [id, zeros()]));
  const applied = new Map(nodeIds.map((id) => [id, appliedForces.get(id)?.slice() ?? zeros()]));
  const perNodeElements = new Map(nodeIds.map((id) => [id, [] as NodeElementForce[]]));

  for (const element of elements) {
    const size = 2 * dofPerNode;
    const stiffness = element.stiffness();
    const u = element.nodeIds.flatMap((id) => displacements.get(id) ?? zeros());
    const onElement = stiffness.map((row) => row.reduce((sum, value, j) => sum + value * u[j], 0));
    const equivalentLoad = element.equivalentLoad?.() ?? new Array<number>(size).fill(0);

    element.nodeIds.forEach((nodeId, end) => {
      const offset = end * dofPerNode;
      const force = onElement.slice(offset, offset + dofPerNode).map((value) => -value);
      perNodeElements.get(nodeId)?.push({ elementId: element.id, force });

      const sum = fromElements.get(nodeId);
      const load = applied.get(nodeId);
      for (let i = 0; i < dofPerNode; i++) {
        if (sum) sum[i] += force[i];
        // La carga nodal equivalente de la barra actúa sobre el nudo igual que
        // una carga del usuario: en `solve()` se suma al mismo vector.
        if (load) load[i] += equivalentLoad[offset + i];
      }
    });
  }

  const global = zeros();
  let scale = 0;
  const track = (value: number) => {
    scale = Math.max(scale, Math.abs(value));
  };

  const nodes: NodeEquilibrium[] = nodeIds.map((nodeId) => {
    const bars = fromElements.get(nodeId) ?? zeros();
    const load = applied.get(nodeId) ?? zeros();
    const reaction = reactions.get(nodeId)?.slice() ?? zeros();
    const residual = bars.map((value, i) => value + load[i] + reaction[i]);

    for (let i = 0; i < dofPerNode; i++) {
      global[i] += load[i] + reaction[i];
      track(bars[i]);
      track(load[i]);
      track(reaction[i]);
    }

    return {
      nodeId,
      elements: perNodeElements.get(nodeId) ?? [],
      fromElements: bars,
      applied: load,
      reaction,
      residual,
    };
  });

  const maxResidual = [...nodes.flatMap((n) => n.residual), ...global].reduce(
    (max, value) => Math.max(max, Math.abs(value)),
    0,
  );

  return {
    nodes,
    global,
    maxResidual,
    scale,
    ok: maxResidual <= EQUILIBRIUM_TOLERANCE * scale || maxResidual < ABSOLUTE_FLOOR,
  };
}
