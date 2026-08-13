import { describe, expect, it } from "vitest";

import { System } from "./system";
import { TrussElement2D } from "./trusses-2d/truss-element-2d";
import { unitDisplacementState } from "./unit-displacement";

/**
 * Una armadura mínima: dos nudos apoyados abajo y uno libre arriba. Alcanza
 * para fijar el contrato, y los valores salen del propio ensamblaje, no de
 * números copiados a mano — lo que se afirma es la **relación** entre la
 * columna de K y el estado, no una tabla de resultados.
 */
function armadura() {
  const system = new System(2);
  system.addNode({ id: "v1", restrained: [true, true] });
  system.addNode({ id: "v2", restrained: [true, true] });
  system.addNode({ id: "v3", restrained: [false, false], force: [0, -10] });
  system.addElement(
    new TrussElement2D("e1", { id: "v1", x: 0, z: 0 }, { id: "v3", x: 0, z: 4 }, 0.001, 2e7),
  );
  system.addElement(
    new TrussElement2D("e2", { id: "v2", x: 3, z: 0 }, { id: "v3", x: 0, z: 4 }, 0.001, 2e7),
  );
  return system.solve().assembly;
}

describe("unitDisplacementState", () => {
  it("pone un 1 en el grado de libertad elegido y ceros en todos los demás", () => {
    const assembly = armadura();
    const v3x = assembly.dofOrder.find((e) => e.nodeId === "v3" && e.localDof === 0)!;

    const { displacements } = unitDisplacementState(assembly, v3x.globalIndex);

    expect(displacements.get("v3")).toEqual([1, 0]);
    expect(displacements.get("v1")).toEqual([0, 0]);
    expect(displacements.get("v2")).toEqual([0, 0]);
  });

  it("devuelve la columna de K, que es la definición de la matriz", () => {
    const assembly = armadura();
    const v3z = assembly.dofOrder.find((e) => e.nodeId === "v3" && e.localDof === 1)!;

    const { forces } = unitDisplacementState(assembly, v3z.globalIndex);

    // `k_ij` = fuerza en i por desplazamiento unitario en j: la columna entera,
    // incluida la fila del propio DOF (el término diagonal).
    for (const entry of assembly.dofOrder) {
      const force = forces.find((f) => f.nodeId === entry.nodeId && f.localDof === entry.localDof)!;
      expect(force.value).toBe(assembly.globalStiffness[entry.globalIndex][v3z.globalIndex]);
    }
  });

  it("también sirve para un grado de libertad restringido: ahí la columna es la reacción", () => {
    const assembly = armadura();
    const v1z = assembly.dofOrder.find((e) => e.nodeId === "v1" && e.localDof === 1)!;

    const { displacements, forces } = unitDisplacementState(assembly, v1z.globalIndex);

    expect(displacements.get("v1")).toEqual([0, 1]);
    // Mover el apoyo hacia arriba estira la barra que llega ahí, así que cuesta.
    const propio = forces.find((f) => f.nodeId === "v1" && f.localDof === 1)!;
    expect(Math.abs(propio.value)).toBeGreaterThan(0);
  });

  it("un término diagonal en cero significa que ahí no hay nada que se oponga", () => {
    const assembly = armadura();
    const v1x = assembly.dofOrder.find((e) => e.nodeId === "v1" && e.localDof === 0)!;

    const { forces } = unitDisplacementState(assembly, v1x.globalIndex);
    const propio = forces.find((f) => f.nodeId === "v1" && f.localDof === 0)!;

    // No es un caso raro ni un bug: a `v1` solo llega la barra **vertical** `e1`,
    // y una barra de armadura solo tiene rigidez sobre su propio eje. Mover `v1`
    // horizontalmente no estira nada, así que no hace falta ninguna fuerza — y
    // por eso ese grado de libertad, si estuviera libre, sería un mecanismo. Es
    // exactamente lo que muestra el diagnóstico de matriz singular.
    expect(propio.value).toBe(0);
  });

  it("la matriz es simétrica, así que la columna j vale también como fila j", () => {
    const assembly = armadura();
    const { globalStiffness, dofOrder } = assembly;

    for (const j of dofOrder) {
      const { forces } = unitDisplacementState(assembly, j.globalIndex);
      for (const i of dofOrder) {
        const fuerza = forces.find((f) => f.nodeId === i.nodeId && f.localDof === i.localDof)!;
        expect(fuerza.value).toBeCloseTo(globalStiffness[j.globalIndex][i.globalIndex], 10);
      }
    }
  });

  it("rechaza un grado de libertad que no existe", () => {
    const assembly = armadura();

    expect(() => unitDisplacementState(assembly, 99)).toThrow(/no existe/);
    expect(() => unitDisplacementState(assembly, -1)).toThrow(/no existe/);
  });
});
