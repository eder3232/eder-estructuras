import { describe, expect, it } from "vitest";
import { System } from "../system";
import { SpringElement } from "./spring-element";

describe("SpringElement + System — caso de 2 nodos", () => {
  it("resuelve desplazamiento y reacción de un resorte simple", () => {
    const system = new System(1);

    system.addNode({ id: "a", restrained: [true] });
    system.addNode({ id: "b", restrained: [false], force: [5] });
    system.addElement(new SpringElement("e1", ["a", "b"], 10));

    const { displacements, reactions, internalForces } = system.solve();

    expect(displacements.get("b")![0]).toBeCloseTo(0.5, 6);
    expect(displacements.get("a")![0]).toBeCloseTo(0, 6);
    expect(reactions.get("a")![0]).toBeCloseTo(-5, 6);
    expect(internalForces.get("e1")).toEqual({ axialForce: 5 });
  });
});
