import { describe, expect, it } from "vitest";

import { System } from "./system";
import { TrussElement2D } from "./trusses-2d/truss-element-2d";
import { cellContributions } from "./cell-contributions";

/**
 * Un triángulo: v1 y v2 abajo (restringidos), v3 arriba con carga. Chico a
 * propósito — lo que se fija es qué barra aporta dónde, no los números.
 */
function armadura() {
  const area = 10 * 10 ** -4;
  const elasticity = 2 * 10 ** 7;
  const system = new System(2);
  system.addNode({ id: "v1", restrained: [true, true] });
  system.addNode({ id: "v2", restrained: [true, true] });
  system.addNode({ id: "v3", restrained: [false, false], force: [0, -10] });
  system.addElement(
    new TrussElement2D("e1", { id: "v1", x: 0, z: 0 }, { id: "v2", x: 3, z: 0 }, area, elasticity),
  );
  system.addElement(
    new TrussElement2D("e2", { id: "v1", x: 0, z: 0 }, { id: "v3", x: 0, z: 4 }, area, elasticity),
  );
  system.addElement(
    new TrussElement2D("e3", { id: "v2", x: 3, z: 0 }, { id: "v3", x: 0, z: 4 }, area, elasticity),
  );
  return system;
}

const elements = [
  { id: "e1", nodeIds: ["v1", "v2"] },
  { id: "e2", nodeIds: ["v1", "v3"] },
  { id: "e3", nodeIds: ["v2", "v3"] },
];

describe("cellContributions", () => {
  const { assembly } = armadura().solve();
  const { steps, dofOrder } = assembly;
  const indice = (nodeId: string, localDof: number) =>
    dofOrder.findIndex((e) => e.nodeId === nodeId && e.localDof === localDof);

  const en = (a: [string, number], b: [string, number]) =>
    cellContributions(steps, elements, dofOrder, indice(...a), indice(...b));

  it("en la diagonal de un nudo aportan todas las barras que llegan a ese nudo", () => {
    // A v1 llegan e1 y e2.
    expect(en(["v1", 0], ["v1", 0]).map((c) => c.elementId)).toEqual(["e1", "e2"]);
  });

  it("fuera de la diagonal, solo la barra que conecta esos dos nudos", () => {
    expect(en(["v1", 0], ["v2", 0]).map((c) => c.elementId)).toEqual(["e1"]);
    expect(en(["v1", 0], ["v3", 0]).map((c) => c.elementId)).toEqual(["e2"]);
  });

  it("si ninguna barra conecta los dos nudos, no aporta nadie — por eso el cero", () => {
    // v2 y v3 sí están conectados; el caso vacío hay que buscarlo en un modelo
    // con un par sin barra, así que se usa uno recortado.
    const contribuciones = cellContributions(
      steps,
      [{ id: "e1", nodeIds: ["v1", "v2"] }],
      dofOrder,
      indice("v1", 0),
      indice("v3", 0),
    );
    expect(contribuciones).toEqual([]);
  });

  it("una barra que toca los dos nudos pero no aporta a esa dirección devuelve cero", () => {
    // e1 es horizontal (v1→v2), así que no tiene ninguna rigidez en z: es
    // exactamente el mecanismo que el motor diagnostica cuando ya es tarde.
    const [contribucion] = en(["v1", 1], ["v2", 1]);

    expect(contribucion.elementId).toBe("e1");
    expect(contribucion.value).toBeCloseTo(0, 10);
  });

  it("la suma de los aportes es el valor de la celda", () => {
    const fila = indice("v1", 0);
    const suma = en(["v1", 0], ["v1", 0]).reduce((acc, c) => acc + c.value, 0);

    expect(suma).toBeCloseTo(assembly.globalStiffness[fila][fila], 8);
  });
});
