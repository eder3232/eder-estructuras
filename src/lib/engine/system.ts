import { add, inv, multiply, subtract, zeros } from "mathjs";
import type { Element } from "./element";
import type { Node } from "./node";

export interface AddNodeInput {
  id: string;
  restrained: boolean[];
  force?: number[];
  displacement?: number[];
}

export interface SolveResult {
  displacements: Map<string, number[]>;
  reactions: Map<string, number[]>;
  internalForces: Map<string, unknown>;
}

interface DofIndex {
  /** Índice global (0..t-1) por nodo, uno por grado de libertad local. */
  byNode: Map<string, number[]>;
  free: number[];
  restrained: number[];
}

export class System {
  private readonly nodes = new Map<string, Node>();
  private readonly elements = new Map<string, Element>();

  constructor(private readonly dofPerNode: number) {
    if (!Number.isInteger(dofPerNode) || dofPerNode < 1) {
      throw new Error("dofPerNode debe ser un entero mayor o igual a 1.");
    }
  }

  addNode({ id, restrained, force, displacement }: AddNodeInput): void {
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

    this.nodes.set(id, { id, dof });
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

  private buildDOFOrder(): DofIndex {
    const byNode = new Map<string, number[]>();
    const free: number[] = [];
    const restrained: number[] = [];

    let cursor = 0;
    for (const node of this.nodes.values()) {
      const indices: number[] = [];
      for (const dof of node.dof) {
        const globalIndex = cursor++;
        indices.push(globalIndex);
        (dof.restrained ? restrained : free).push(globalIndex);
      }
      byNode.set(node.id, indices);
    }

    return { byNode, free, restrained };
  }

  private elementDofMap(element: Element, dofIndex: DofIndex): number[] {
    const [fromId, toId] = element.nodeIds;
    return [...dofIndex.byNode.get(fromId)!, ...dofIndex.byNode.get(toId)!];
  }

  private assembleGlobal(dofIndex: DofIndex): { k: number[][]; f0: number[] } {
    const t = this.nodes.size * this.dofPerNode;
    const k: number[][] = zeros(t, t).valueOf() as number[][];
    const f0: number[] = new Array(t).fill(0);

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
    }

    return { k, f0 };
  }

  private gather(matrix: number[][], rows: number[], cols: number[]): number[][] {
    return rows.map((r) => cols.map((c) => matrix[r][c]));
  }

  private gatherVector(vector: number[], indices: number[]): number[] {
    return indices.map((i) => vector[i]);
  }

  solve(): SolveResult {
    const dofIndex = this.buildDOFOrder();
    const { k, f0 } = this.assembleGlobal(dofIndex);

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

    const kfrUr = restrained.length > 0 ? (multiply(kfr, ur) as number[][]) : free.map(() => [0]);
    const netFf = subtract(ff, kfrUr) as number[][];

    let uf: number[][];
    if (free.length > 0) {
      uf = multiply(inv(kff), netFf) as number[][];
    } else {
      uf = [];
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

    return { displacements, reactions, internalForces };
  }
}
