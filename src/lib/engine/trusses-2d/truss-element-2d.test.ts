import { describe, expect, it } from "vitest";
import { System } from "../system";
import { TrussElement2D } from "./truss-element-2d";

describe("TrussElement2D + System — sanity de 1 barra horizontal", () => {
  it("se reduce al caso axial puro cuando el DOF perpendicular está restringido", () => {
    const area = 1;
    const elasticity = 10;
    const length = 2;
    const force = 10;
    const eaOverL = (elasticity * area) / length; // 5

    const system = new System(2);
    system.addNode({ id: "a", restrained: [true, true] });
    system.addNode({ id: "b", restrained: [false, true], force: [force, 0] });
    system.addElement(
      new TrussElement2D("e1", { id: "a", x: 0, z: 0 }, { id: "b", x: length, z: 0 }, area, elasticity),
    );

    const { displacements, reactions, internalForces } = system.solve();

    expect(displacements.get("b")![0]).toBeCloseTo(force / eaOverL, 6);
    expect(displacements.get("b")![1]).toBeCloseTo(0, 6);

    expect(reactions.get("a")![0]).toBeCloseTo(-force, 6);
    expect(reactions.get("a")![1]).toBeCloseTo(0, 6);
    expect(reactions.get("b")![1]).toBeCloseTo(0, 6);

    expect((internalForces.get("e1") as { axialForce: number }).axialForce).toBeCloseTo(force, 6);
  });

  it("rechaza área o módulo de elasticidad no positivos", () => {
    const p1 = { id: "a", x: 0, z: 0 };
    const p2 = { id: "b", x: 1, z: 0 };
    expect(() => new TrussElement2D("e1", p1, p2, 0, 10)).toThrow(/área positiva/);
    expect(() => new TrussElement2D("e1", p1, p2, 1, 0)).toThrow(/elasticidad positivo/);
  });

  it("rechaza barras de longitud cero", () => {
    const p = { id: "a", x: 1, z: 1 };
    expect(() => new TrussElement2D("e1", p, { ...p, id: "b" }, 1, 10)).toThrow(/longitud cero/);
  });
});
