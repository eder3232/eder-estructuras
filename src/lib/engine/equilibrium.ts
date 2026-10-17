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
  /**
   * La carga que el usuario puso **en el nudo**. Las cargas a lo largo de una
   * barra no van acá: entran por la fuerza de esa barra (ver `elements`).
   */
  applied: number[];
  /** La reacción del apoyo — cero en los grados de libertad libres. */
  reaction: number[];
  /**
   * Solo nudos de un diafragma rígido: la fuerza que **el diafragma** le hace
   * al nudo en el grado compartido (cero en los demás). No sale de ninguna
   * barra —es la que reparte el piso entre sus nudos—, así que se deduce: es
   * lo que le falta al nudo para estar en equilibrio. Lo que se comprueba de
   * verdad es que esas fuerzas sumen cero en el grupo (`diaphragms`).
   */
  diaphragm?: number[];
  /** `fromElements + applied + reaction` (`+ diaphragm`). Tiene que dar cero. */
  residual: number[];
}

/**
 * El diafragma es interno a la estructura: lo que les da a unos nudos se lo
 * quita a otros. **Sus fuerzas suman cero**, y eso es lo que se controla.
 */
export interface DiaphragmEquilibrium {
  id: string;
  /** Por nudo, en el orden del grupo. */
  forces: { nodeId: string; force: number }[];
  /** La suma de `forces`. Tiene que dar cero. */
  residual: number;
}

export interface EquilibriumCheck {
  nodes: NodeEquilibrium[];
  /**
   * Cargas + reacciones de toda la estructura, incluidas las cargas a lo largo
   * de las barras (por su carga nodal equivalente, que tiene la misma
   * resultante). Las fuerzas entre barras y nudos **no** aparecen: son
   * internas. Que esto dé cero es una comprobación distinta de la de cada nudo.
   *
   * En un **pórtico plano** la tercera componente es la suma de momentos
   * **respecto del origen**, con brazos de palanca. Sumar los momentos de los
   * nudos sin más no es una ecuación de equilibrio: así estaba, y daba «no
   * cierra» en cualquier pórtico con dos empotramientos (en el inicial, la
   * suma de los dos momentos de reacción, 9.19). No se había visto porque
   * `/frame2d` no mostraba esta verificación.
   */
  global: number[];
  /** Uno por diafragma rígido; vacío si no hay. */
  diaphragms: DiaphragmEquilibrium[];
  /** El mayor `|residuo|` de todos, incluido el global y el de los diafragmas. */
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
  /** Los diafragmas rígidos del sistema (ver `System.addDiaphragm`). */
  diaphragms?: readonly { id: string; nodeIds: readonly string[]; localDof: number }[];
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
  diaphragms = [],
}: EquilibriumInput): EquilibriumCheck {
  const diaphragmDof = new Map<string, number>();
  for (const diaphragm of diaphragms) {
    for (const nodeId of diaphragm.nodeIds) diaphragmDof.set(nodeId, diaphragm.localDof);
  }
  const zeros = () => new Array<number>(dofPerNode).fill(0);
  const fromElements = new Map(nodeIds.map((id) => [id, zeros()]));
  const applied = new Map(nodeIds.map((id) => [id, appliedForces.get(id)?.slice() ?? zeros()]));
  const perNodeElements = new Map(nodeIds.map((id) => [id, [] as NodeElementForce[]]));
  // Las cargas de barra, puestas en los nudos: solo cuentan para el equilibrio global.
  const memberLoadAt = new Map(nodeIds.map((id) => [id, zeros()]));
  const positions = new Map<string, { x: number; z: number }>();

  for (const element of elements) {
    const size = 2 * dofPerNode;
    const stiffness = element.stiffness();
    const u = element.nodeIds.flatMap((id) => displacements.get(id) ?? zeros());
    const onElement = stiffness.map((row) => row.reduce((sum, value, j) => sum + value * u[j], 0));
    const equivalentLoad = element.equivalentLoad?.() ?? new Array<number>(size).fill(0);

    element.nodeIds.forEach((nodeId, end) => {
      const offset = end * dofPerNode;
      const position = element.nodePositions?.[end];
      if (position) positions.set(nodeId, position);
      const memberLoad = memberLoadAt.get(nodeId);
      if (memberLoad) for (let i = 0; i < dofPerNode; i++) memberLoad[i] += equivalentLoad[offset + i];
      // Lo que la barra le hace al nudo es el opuesto de su fuerza de extremo
      // **verdadera**: `k·u` más el FEM (en globales, `k·u − F_eq`). En
      // `solve()` la carga equivalente se suma al vector de cargas del nudo, y
      // acá se hacía lo mismo — la suma da igual, pero entonces la columna
      // «carga» de un pórtico mostraba una carga que el alumno nunca puso en
      // el nudo, y la fuerza de la barra no era la de la tabla de fuerzas
      // internas. Así el nudo queda dibujado como su diagrama de cuerpo libre.
      const force = onElement
        .slice(offset, offset + dofPerNode)
        .map((value, i) => -(value - equivalentLoad[offset + i]));
      perNodeElements.get(nodeId)?.push({ elementId: element.id, force });

      const sum = fromElements.get(nodeId);
      for (let i = 0; i < dofPerNode; i++) {
        if (sum) sum[i] += force[i];
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
    const sharedDof = diaphragmDof.get(nodeId);
    let diaphragm: number[] | undefined;
    if (sharedDof !== undefined) {
      diaphragm = zeros();
      // `0 -` y no `-`: un `-0` no es un dato.
      diaphragm[sharedDof] = 0 - residual[sharedDof];
      residual[sharedDof] = 0;
    }

    const external = load.map((value, i) => value + reaction[i] + (memberLoadAt.get(nodeId)?.[i] ?? 0));
    const position = positions.get(nodeId);
    for (let i = 0; i < dofPerNode; i++) {
      global[i] += external[i];
      track(bars[i]);
      track(load[i]);
      track(reaction[i]);
    }
    // Pórtico plano: el momento de las fuerzas del nudo respecto del origen,
    // M = x·Fz − z·Fx, además de su momento propio.
    if (position && dofPerNode === 3) global[2] += position.x * external[1] - position.z * external[0];

    return {
      nodeId,
      elements: perNodeElements.get(nodeId) ?? [],
      fromElements: bars,
      applied: load,
      reaction,
      ...(diaphragm ? { diaphragm } : {}),
      residual,
    };
  });

  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const diaphragmChecks: DiaphragmEquilibrium[] = diaphragms.map(({ id, nodeIds: members, localDof }) => {
    const forces = members.map((nodeId) => ({ nodeId, force: byId.get(nodeId)?.diaphragm?.[localDof] ?? 0 }));
    return { id, forces, residual: forces.reduce((sum, f) => sum + f.force, 0) };
  });

  const maxResidual = [
    ...nodes.flatMap((n) => n.residual),
    ...global,
    ...diaphragmChecks.map((d) => d.residual),
  ].reduce(
    (max, value) => Math.max(max, Math.abs(value)),
    0,
  );

  return {
    nodes,
    global,
    diaphragms: diaphragmChecks,
    maxResidual,
    scale,
    ok: maxResidual <= EQUILIBRIUM_TOLERANCE * scale || maxResidual < ABSOLUTE_FLOOR,
  };
}
