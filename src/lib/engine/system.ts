import { add, inv, multiply, subtract, zeros } from "mathjs";
import { CONDITION_LIMIT, SingularStiffnessError, conditionEstimate, nullMode, zeroStiffnessRows } from "./mechanism";
import type { MechanismDiagnosis, MechanismDof } from "./mechanism";
import { dofNumberingWarning, illConditionedWarning, unconnectedNodeWarnings } from "./warnings";
import type { SolveWarning } from "./warnings";
import type { Element } from "./element";
import type { Node } from "./node";

export interface AddNodeInput {
  id: string;
  restrained: boolean[];
  force?: number[];
  displacement?: number[];
  /** Ver `Node.dofNumbers`: la numeración que pidió el alumno, si la pidió. */
  dofNumbers?: number[];
}

export interface DofOrderEntry {
  nodeId: string;
  localDof: number;
  globalIndex: number;
  restrained: boolean;
}

export interface PartitionResult {
  free: number[];
  restrained: number[];
  kff: number[][];
  kfr: number[][];
  krf: number[][];
  krr: number[][];
}

export interface AssemblyStep {
  elementId: string;
  globalStiffnessAfter: number[][];
}

export interface AssemblyResult {
  dofOrder: DofOrderEntry[];
  globalStiffness: number[][];
  steps: AssemblyStep[];
  partition: PartitionResult;
  /**
   * Con qué criterio se numeraron los grados de libertad, para que quien
   * muestre la partición la acomode igual. No se puede deducir mirando los
   * datos —en un modelo cualquiera el primer DOF puede ser restringido por
   * casualidad—, así que viaja explícito.
   */
  restrainedFirst: boolean;
}

/**
 * Cómo se numeran los grados de libertad antes de ensamblar.
 *
 * **Existe porque cada profesor lo hace distinto**: unos ponen los grados
 * restringidos arriba de la matriz global y otros abajo. Matemáticamente da lo
 * mismo —los desplazamientos, las reacciones y los esfuerzos son idénticos—
 * pero al que recién aprende el método una matriz que no se parece a la del
 * pizarrón lo desorienta. Ver `docs/pendientes-comparacion.md`, grupo M.
 */
export interface DofOrderOptions {
  /** `false` (el valor por defecto) numera por orden de inserción de los nudos. */
  restrainedFirst?: boolean;
  /**
   * Si se usa la numeración que cargó el alumno (`Node.dofNumbers`) para
   * ordenar los grados de libertad. **Cuando está encendida, manda ella**:
   * `restrainedFirst` deja de aplicar al ensamblaje (sigue decidiendo cómo se
   * agrupa la partición al mostrarla).
   *
   * Existe porque el profesor a veces numera de una forma rara a propósito,
   * para ver si el alumno entendió el método — y el alumno quiere cotejar sus
   * matrices contra las de la pantalla término a término.
   *
   * **Se respeta tal cual, aunque mezcle restringidos con libres.** El original
   * no podía: cortaba la matriz por posición, así que necesitaba los dos grupos
   * contiguos y usaba el número solo como desempate dentro de cada uno. Acá la
   * partición junta por lista de índices, así que no hace falta.
   */
  useDofNumbers?: boolean;
}

export interface SolveResult {
  displacements: Map<string, number[]>;
  reactions: Map<string, number[]>;
  internalForces: Map<string, unknown>;
  assembly: AssemblyResult;
  /**
   * Lo que hay para decir sobre **estos** resultados, que existen. Nunca impide
   * mostrarlos: si algo tiene que impedirlo es un error y se tira. Ver
   * `warnings.ts` y `docs/errores.md`.
   */
  warnings: SolveWarning[];
}

interface DofEntry {
  nodeId: string;
  localDof: number;
  restrained: boolean;
  /** El número que pidió el alumno, o 0 si no pidió ninguno. */
  number: number;
}

interface DofIndex {
  /** Índice global (0..t-1) por nodo, uno por grado de libertad local. */
  byNode: Map<string, number[]>;
  free: number[];
  restrained: number[];
  /** Los números que pidió el alumno, en el orden que salieron. Vacío si no numeró. */
  numbers: number[];
}

export class System {
  private readonly nodes = new Map<string, Node>();
  private readonly elements = new Map<string, Element>();

  constructor(private readonly dofPerNode: number) {
    if (!Number.isInteger(dofPerNode) || dofPerNode < 1) {
      throw new Error("dofPerNode debe ser un entero mayor o igual a 1.");
    }
  }

  addNode({ id, restrained, force, displacement, dofNumbers }: AddNodeInput): void {
    if (this.nodes.has(id)) {
      throw new Error(`El nodo ${id} ya existe.`);
    }
    if (restrained.length !== this.dofPerNode) {
      throw new Error(
        `El nodo ${id} debe declarar ${this.dofPerNode} grado(s) de libertad, recibió ${restrained.length}.`,
      );
    }

    const forceValues = force ?? new Array(this.dofPerNode).fill(0);
    const displacementValues = displacement ?? new Array(this.dofPerNode).fill(0);

    if (forceValues.length !== this.dofPerNode || displacementValues.length !== this.dofPerNode) {
      throw new Error(`El nodo ${id} tiene vectores de fuerza/desplazamiento de longitud incorrecta.`);
    }

    const dof = restrained.map((isRestrained, i) => {
      if (isRestrained && forceValues[i] !== 0) {
        throw new Error(
          `El nodo ${id} no puede tener fuerza aplicada en el DOF ${i}: está restringido.`,
        );
      }
      if (!isRestrained && displacementValues[i] !== 0) {
        throw new Error(
          `El nodo ${id} no puede tener desplazamiento prescrito en el DOF ${i}: no está restringido.`,
        );
      }
      return {
        restrained: isRestrained,
        force: forceValues[i],
        displacement: displacementValues[i],
      };
    });

    this.nodes.set(id, { id, dof, dofNumbers });
  }

  addElement(element: Element): void {
    if (this.elements.has(element.id)) {
      throw new Error(`El elemento ${element.id} ya existe.`);
    }
    for (const nodeId of element.nodeIds) {
      if (!this.nodes.has(nodeId)) {
        throw new Error(`El elemento ${element.id} referencia al nodo ${nodeId}, que no existe.`);
      }
    }
    this.elements.set(element.id, element);
  }

  /**
   * El orden de los grados de libertad, que es **una sola decisión** de la que
   * cuelga todo lo demás: el ensamblaje usa `byNode`, la partición junta por
   * lista de índices y la UI se etiqueta con `dofOrder`. Nada de eso supone un
   * orden en particular, así que cambiarlo acá no obliga a tocar nada más.
   *
   * (El proyecto original cortaba la matriz **por posición**, y por eso el
   * mismo cambio le costaba duplicar la función que la partía.)
   */
  private buildDOFOrder({ restrainedFirst = false, useDofNumbers = false }: DofOrderOptions): DofIndex {
    const entries: DofEntry[] = [];
    for (const node of this.nodes.values()) {
      node.dof.forEach((dof, localDof) =>
        entries.push({
          nodeId: node.id,
          localDof,
          restrained: dof.restrained,
          number: useDofNumbers ? (node.dofNumbers?.[localDof] ?? 0) : 0,
        }),
      );
    }

    // `sort` es estable desde ES2019, así que empatar —o no numerar nada— deja
    // el orden de inserción intacto.
    const byNumber = (list: DofEntry[]) => [...list].sort((a, b) => a.number - b.number);

    // **Si el alumno numeró, el alumno manda: se respeta tal cual, aunque
    // mezcle restringidos con libres.** El original no podía hacer esto —cortaba
    // la matriz por posición, así que necesitaba los dos grupos contiguos y
    // terminaba usando el número solo como desempate dentro de cada grupo—.
    // Acá la partición junta por lista de índices, así que no necesita
    // contigüidad: el paso de reordenar para partir ya existe y se muestra
    // aparte, que es justamente lo que hay que entender.
    const ordered = useDofNumbers
      ? byNumber(entries)
      : restrainedFirst
        ? [...entries.filter((e) => e.restrained), ...entries.filter((e) => !e.restrained)]
        : entries;

    const byNode = new Map<string, number[]>();
    const free: number[] = [];
    const restrained: number[] = [];

    ordered.forEach((entry, globalIndex) => {
      const indices = byNode.get(entry.nodeId) ?? [];
      indices[entry.localDof] = globalIndex;
      byNode.set(entry.nodeId, indices);
      (entry.restrained ? restrained : free).push(globalIndex);
    });

    return { byNode, free, restrained, numbers: useDofNumbers ? ordered.map((e) => e.number) : [] };
  }

  private elementDofMap(element: Element, dofIndex: DofIndex): number[] {
    const [fromId, toId] = element.nodeIds;
    return [...dofIndex.byNode.get(fromId)!, ...dofIndex.byNode.get(toId)!];
  }

  private assembleGlobal(dofIndex: DofIndex): { k: number[][]; f0: number[]; steps: AssemblyStep[] } {
    const t = this.nodes.size * this.dofPerNode;
    const k: number[][] = zeros(t, t).valueOf() as number[][];
    const f0: number[] = new Array(t).fill(0);
    const steps: AssemblyStep[] = [];

    for (const element of this.elements.values()) {
      const map = this.elementDofMap(element, dofIndex);
      const localK = element.stiffness();
      const size = 2 * this.dofPerNode;

      if (localK.length !== size || localK.some((row) => row.length !== size)) {
        throw new Error(
          `El elemento ${element.id} devolvió una matriz de rigidez de tamaño incorrecto (esperado ${size}x${size}).`,
        );
      }

      for (let i = 0; i < size; i++) {
        const row = map[i];
        for (let j = 0; j < size; j++) {
          const col = map[j];
          k[row][col] += localK[i][j];
        }
      }

      const localF0 = element.equivalentLoad?.() ?? new Array(size).fill(0);
      for (let i = 0; i < size; i++) {
        f0[map[i]] += localF0[i];
      }

      steps.push({ elementId: element.id, globalStiffnessAfter: k.map((row) => [...row]) });
    }

    return { k, f0, steps };
  }

  private gather(matrix: number[][], rows: number[], cols: number[]): number[][] {
    return rows.map((r) => cols.map((c) => matrix[r][c]));
  }

  private gatherVector(vector: number[], indices: number[]): number[] {
    return indices.map((i) => vector[i]);
  }

  /**
   * Traduce el diagnóstico de `mechanism.ts` —que trabaja con índices de la
   * submatriz libre— a nudos y grados de libertad, que es lo único que la UI
   * puede dibujar.
   */
  private diagnoseMechanism(kff: number[][], free: number[], dofIndex: DofIndex): MechanismDiagnosis {
    const byGlobalIndex = new Map<number, MechanismDof>();
    for (const [nodeId, indices] of dofIndex.byNode) {
      indices.forEach((globalIndex, localDof) => byGlobalIndex.set(globalIndex, { nodeId, localDof }));
    }
    const dofAt = (freeIndex: number) => byGlobalIndex.get(free[freeIndex])!;

    const mode = nullMode(kff);

    return {
      loose: zeroStiffnessRows(kff).map(dofAt),
      mode: mode ? mode.map((value, i) => ({ ...dofAt(i), value })) : null,
    };
  }

  solve(options: DofOrderOptions = {}): SolveResult {
    const dofIndex = this.buildDOFOrder(options);
    const { k, f0, steps } = this.assembleGlobal(dofIndex);
    const warnings: SolveWarning[] = unconnectedNodeWarnings(
      [...this.nodes.keys()],
      [...this.elements.values()],
    );

    const numbering = dofNumberingWarning(dofIndex.numbers);
    if (numbering) warnings.push(numbering);

    const nodesInOrder = [...this.nodes.values()];
    const t = nodesInOrder.length * this.dofPerNode;

    const appliedForce = new Array(t).fill(0);
    const prescribedDisplacement = new Array(t).fill(0);
    for (const node of nodesInOrder) {
      const indices = dofIndex.byNode.get(node.id)!;
      node.dof.forEach((d, i) => {
        appliedForce[indices[i]] = d.force;
        prescribedDisplacement[indices[i]] = d.displacement;
      });
    }

    const { free, restrained } = dofIndex;
    const kff = this.gather(k, free, free);
    const kfr = this.gather(k, free, restrained);
    const krf = this.gather(k, restrained, free);
    const krr = this.gather(k, restrained, restrained);

    const f0f = this.gatherVector(f0, free);
    const ff = this.gatherVector(appliedForce, free).map((v, i) => [v + f0f[i]]);
    const ur = this.gatherVector(prescribedDisplacement, restrained).map((v) => [v]);
    const f0r = this.gatherVector(f0, restrained).map((v) => [v]);

    // Sin DOF libres no hay nada que resolver, y además `kfr`/`kff` quedan sin
    // filas: mathjs no multiplica matrices vacías. Es un caso real, no teórico
    // — una barra con los dos extremos empotrados y carga repartida a lo largo
    // (el ejemplo clásico de empotramiento perfecto) no tiene ningún DOF libre.
    let uf: number[][] = [];
    if (free.length > 0) {
      const kfrUr = restrained.length > 0 ? (multiply(kfr, ur) as number[][]) : free.map(() => [0]);
      const netFf = subtract(ff, kfrUr) as number[][];

      // **No alcanza con esperar a que `inv` falle.** mathjs solo tira error si
      // el determinante da exactamente cero, y una estructura que es un
      // mecanismo suele dar 10⁻¹⁰ por redondeo: ahí devuelve una "inversa" y el
      // sistema entero se resuelve con números sin ningún sentido, sin avisar.
      // Se comprobó con una armadura sin ningún apoyo horizontal.
      //
      // Por eso hay dos controles. El primero es exacto y barato: una fila nula
      // es un grado de libertad al que no se opone nada.
      if (zeroStiffnessRows(kff).length > 0) {
        throw new SingularStiffnessError(this.diagnoseMechanism(kff, free, dofIndex));
      }

      let inverse: number[][];
      try {
        inverse = inv(kff) as number[][];
      } catch {
        throw new SingularStiffnessError(this.diagnoseMechanism(kff, free, dofIndex));
      }
      uf = multiply(inverse, netFf) as number[][];

      // El segundo mira **la inversa que salió**: si el número de condición se
      // dispara, esos desplazamientos no tienen ningún dígito que valga. Es el
      // control que atrapa el mecanismo que `inv` deja pasar.
      const condition = conditionEstimate(kff, inverse);
      if (condition > CONDITION_LIMIT) {
        throw new SingularStiffnessError(this.diagnoseMechanism(kff, free, dofIndex));
      }

      // Entre "sano" y "es un mecanismo" hay una franja donde el cálculo sale
      // pero con la mitad de los dígitos perdidos. Eso no se rechaza: se avisa.
      const illConditioned = illConditionedWarning(condition);
      if (illConditioned) warnings.push(illConditioned);
    }

    const krfUf = free.length > 0 ? (multiply(krf, uf) as number[][]) : restrained.map(() => [0]);
    const krrUr = restrained.length > 0 ? (multiply(krr, ur) as number[][]) : restrained.map(() => [0]);
    const rr = subtract(add(krfUf, krrUr) as number[][], f0r) as number[][];

    const uGlobal = new Array(t).fill(0);
    free.forEach((globalIndex, i) => {
      uGlobal[globalIndex] = uf[i][0];
    });
    restrained.forEach((globalIndex, i) => {
      uGlobal[globalIndex] = ur[i][0];
    });

    const displacements = new Map<string, number[]>();
    const reactions = new Map<string, number[]>();
    for (const node of nodesInOrder) {
      const indices = dofIndex.byNode.get(node.id)!;
      displacements.set(
        node.id,
        indices.map((i) => uGlobal[i]),
      );
      reactions.set(
        node.id,
        node.dof.map((d, i) => {
          if (!d.restrained) return 0;
          const posInRestrained = restrained.indexOf(indices[i]);
          return rr[posInRestrained][0];
        }),
      );
    }

    const internalForces = new Map<string, unknown>();
    for (const element of this.elements.values()) {
      const [fromId, toId] = element.nodeIds;
      internalForces.set(
        element.id,
        element.internalForce([displacements.get(fromId)!, displacements.get(toId)!]),
      );
    }

    const dofOrder: DofOrderEntry[] = [];
    for (const node of nodesInOrder) {
      const indices = dofIndex.byNode.get(node.id)!;
      node.dof.forEach((d, i) => {
        dofOrder.push({ nodeId: node.id, localDof: i, globalIndex: indices[i], restrained: d.restrained });
      });
    }
    // **`dofOrder[i]` tiene que ser la fila `i` de la matriz.** Se arma
    // recorriendo los nudos, así que sin esto queda en orden de inserción y las
    // etiquetas de todas las matrices salen corridas apenas el orden no sea el
    // de inserción.
    dofOrder.sort((a, b) => a.globalIndex - b.globalIndex);

    const partition: PartitionResult = { free, restrained, kff, kfr, krf, krr };

    return {
      displacements,
      reactions,
      internalForces,
      assembly: {
        dofOrder,
        globalStiffness: k,
        steps,
        partition,
        restrainedFirst: options.restrainedFirst ?? false,
      },
      warnings,
    };
  }
}
