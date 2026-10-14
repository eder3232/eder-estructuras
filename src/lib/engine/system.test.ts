import { describe, expect, it } from "vitest";
import { SpringElement } from "./springs/spring-element";
import { System } from "./system";

/**
 * Regresión portada de thesis-structures/src/programs/springs/data/data1.ts
 * (mismo dato de ejemplo de la app original). Valores esperados resueltos a
 * mano — ver docs del plan de Fase 1 para la derivación.
 */
describe("System — regresión red de 5 nodos / 4 resortes", () => {
  it("reproduce los desplazamientos, reacciones y fuerzas internas esperados", () => {
    const system = new System(1);

    system.addNode({ id: "v4", restrained: [true] });
    system.addNode({ id: "v5", restrained: [true] });
    system.addNode({ id: "v1", restrained: [false], force: [5] });
    system.addNode({ id: "v2", restrained: [false], force: [4] });
    system.addNode({ id: "v3", restrained: [false], force: [0] });

    system.addElement(new SpringElement("e1", ["v4", "v2"], 10));
    system.addElement(new SpringElement("e2", ["v2", "v3"], 4));
    system.addElement(new SpringElement("e3", ["v3", "v5"], 3));
    system.addElement(new SpringElement("e4", ["v2", "v1"], 8));

    const { displacements, reactions, internalForces } = system.solve();

    expect(displacements.get("v1")![0]).toBeCloseTo(1.393293, 5);
    expect(displacements.get("v2")![0]).toBeCloseTo(0.768293, 5);
    expect(displacements.get("v3")![0]).toBeCloseTo(0.439024, 5);

    expect(reactions.get("v4")![0]).toBeCloseTo(-7.682927, 5);
    expect(reactions.get("v5")![0]).toBeCloseTo(-1.317073, 5);
    // Equilibrio global: suma de fuerzas aplicadas + reacciones = 0.
    expect(
      reactions.get("v4")![0] + reactions.get("v5")![0] + 5 + 4 + 0,
    ).toBeCloseTo(0, 6);

    expect((internalForces.get("e1") as { axialForce: number }).axialForce).toBeCloseTo(7.682927, 5);
    expect((internalForces.get("e2") as { axialForce: number }).axialForce).toBeCloseTo(-1.317073, 5);
    expect((internalForces.get("e3") as { axialForce: number }).axialForce).toBeCloseTo(-1.317073, 5);
    // v1 solo conecta vía e4, así que su fuerza interna debe igualar la fuerza aplicada en v1.
    expect((internalForces.get("e4") as { axialForce: number }).axialForce).toBeCloseTo(5, 6);
  });

  it("expone el ensamblaje (orden de DOF, historial paso a paso y partición) para uso pedagógico", () => {
    const system = new System(1);

    system.addNode({ id: "v4", restrained: [true] });
    system.addNode({ id: "v5", restrained: [true] });
    system.addNode({ id: "v1", restrained: [false], force: [5] });
    system.addNode({ id: "v2", restrained: [false], force: [4] });
    system.addNode({ id: "v3", restrained: [false], force: [0] });

    system.addElement(new SpringElement("e1", ["v4", "v2"], 10));
    system.addElement(new SpringElement("e2", ["v2", "v3"], 4));
    system.addElement(new SpringElement("e3", ["v3", "v5"], 3));
    system.addElement(new SpringElement("e4", ["v2", "v1"], 8));

    const { assembly } = system.solve();

    expect(assembly.dofOrder.map((d) => d.nodeId)).toEqual(["v4", "v5", "v1", "v2", "v3"]);
    expect(assembly.dofOrder.map((d) => d.restrained)).toEqual([true, true, false, false, false]);

    expect(assembly.steps).toHaveLength(4);

    const expectedGlobal = [
      [10, 0, 0, -10, 0],
      [0, 3, 0, 0, -3],
      [0, 0, 8, -8, 0],
      [-10, 0, -8, 22, -4],
      [0, -3, 0, -4, 7],
    ];
    assembly.globalStiffness.forEach((row, i) =>
      row.forEach((value, j) => expect(value).toBeCloseTo(expectedGlobal[i][j], 8)),
    );
    // El último paso del historial debe coincidir con la matriz global final.
    expect(assembly.steps.at(-1)!.globalStiffnessAfter).toEqual(assembly.globalStiffness);

    expect(assembly.partition.free).toEqual([2, 3, 4]);
    expect(assembly.partition.restrained).toEqual([0, 1]);
  });

  it("dice a qué celda de K va cada grado de libertad de cada barra, también con otro orden", () => {
    const build = () => {
      const system = new System(1);
      system.addNode({ id: "v1", restrained: [false], force: [5] });
      system.addNode({ id: "v2", restrained: [true] });
      system.addNode({ id: "v3", restrained: [false] });
      system.addElement(new SpringElement("e1", ["v1", "v2"], 10));
      system.addElement(new SpringElement("e2", ["v3", "v1"], 4));
      return system;
    };

    // Es el contrato que usa la exportación a Excel: con `dofs` y la rigidez de
    // cada barra se tiene que poder rehacer `K` entera sin mirar el motor.
    for (const restrainedFirst of [false, true]) {
      const { assembly } = build().solve({ restrainedFirst });
      const local = { e1: [[10, -10], [-10, 10]], e2: [[4, -4], [-4, 4]] } as const;
      const rebuilt = assembly.globalStiffness.map((row) => row.map(() => 0));
      for (const step of assembly.steps) {
        const k = local[step.elementId as keyof typeof local];
        step.dofs.forEach((row, i) => step.dofs.forEach((col, j) => (rebuilt[row][col] += k[i][j])));
      }
      expect(rebuilt).toEqual(assembly.globalStiffness);
    }

    expect(build().solve({ restrainedFirst: true }).assembly.steps[0].dofs).toEqual([1, 0]);
  });
});
