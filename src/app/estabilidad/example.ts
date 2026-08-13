import { System, TrussElement2D, type AssemblyResult, type SolveResult } from "@/lib/engine";

/**
 * El ejemplo de toda la página: **un solo triángulo**, y siempre el mismo.
 *
 * Tres nudos son 6 grados de libertad, así que la matriz global entra entera en
 * pantalla y se puede señalar con el dedo — con la armadura de 4 nudos ya son
 * 8×8 y el argumento se pierde entre números. Y que sea el mismo ejemplo en los
 * seis bloques es deliberado: lo que cambia de un bloque a otro son los apoyos y
 * la carga, no la estructura, que es exactamente lo que se quiere mostrar.
 */
export const NODES = [
  { id: "v1", name: "v1", x: 0, z: 0 },
  { id: "v2", name: "v2", x: 4, z: 0 },
  { id: "v3", name: "v3", x: 2, z: 3 },
] as const;

export const ELEMENTS = [
  { id: "e1", name: "e1", fromNodeId: "v1", toNodeId: "v2" },
  { id: "e2", name: "e2", fromNodeId: "v2", toNodeId: "v3" },
  { id: "e3", name: "e3", fromNodeId: "v1", toNodeId: "v3" },
] as const;

export const AREA = 0.001;
export const ELASTICITY = 2e7;

const AXIS = ["x", "z"];

/**
 * Ensambla el ejemplo con apoyos **válidos** y devuelve el resultado.
 *
 * Los apoyos que se usen acá no cambian la matriz global: `K` se ensambla sumando
 * las contribuciones de las barras, y los apoyos solo deciden después qué filas y
 * columnas entran en cada bloque de la partición. Por eso una sola llamada sirve
 * para los seis bloques, incluido el del mecanismo — para ese se recortan otras
 * filas de la misma `K`, que además es la única forma de mirarlo: con apoyos
 * insuficientes `solve()` tira, que es justamente lo que la página explica.
 */
export function buildExample(elasticity: number = ELASTICITY): SolveResult {
  const system = new System(2);
  const byId = new Map(NODES.map((n) => [n.id, n]));

  system.addNode({ id: "v1", restrained: [true, true] });
  system.addNode({ id: "v2", restrained: [false, true] });
  system.addNode({ id: "v3", restrained: [false, false], force: [0, -10] });

  for (const element of ELEMENTS) {
    const from = byId.get(element.fromNodeId)!;
    const to = byId.get(element.toNodeId)!;
    system.addElement(
      new TrussElement2D(
        element.id,
        { id: from.id, x: from.x, z: from.z },
        { id: to.id, x: to.x, z: to.z },
        AREA,
        elasticity,
      ),
    );
  }

  return system.solve();
}

/** `v3x`, `v3z`, … en el orden de la matriz global. */
export function dofLabels(assembly: AssemblyResult): string[] {
  return assembly.dofOrder.map((dof) => `${dof.nodeId}${AXIS[dof.localDof]}`);
}

/** El índice global de un grado de libertad, para poder recortar submatrices. */
export function dofIndex(assembly: AssemblyResult, nodeId: string, axis: "x" | "z"): number {
  return assembly.dofOrder.findIndex((d) => d.nodeId === nodeId && d.localDof === (axis === "x" ? 0 : 1));
}

/** Recorta filas y columnas: es lo que hace la partición, sin pasar por `solve()`. */
export function submatrix(matrix: number[][], indices: number[]): number[][] {
  return indices.map((row) => indices.map((col) => matrix[row][col]));
}

/**
 * Las dos configuraciones de apoyo que compara la página, como listas de grados
 * de libertad **libres**.
 *
 * - `stable`: `v1` fijo y `v2` con rodillo. Tres reacciones, bien dispuestas.
 * - `mechanism`: los dos apoyos solo verticales. Nada impide que el triángulo
 *   entero se traslade en horizontal, y ninguna barra se entera.
 */
export function freeDofs(assembly: AssemblyResult) {
  const i = (nodeId: string, axis: "x" | "z") => dofIndex(assembly, nodeId, axis);

  return {
    stable: [i("v2", "x"), i("v3", "x"), i("v3", "z")],
    mechanism: [i("v1", "x"), i("v2", "x"), i("v3", "x"), i("v3", "z")],
  };
}
