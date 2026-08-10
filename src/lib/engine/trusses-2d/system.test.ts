import { describe, expect, it } from "vitest";
import { System } from "../system";
import { TrussElement2D } from "./truss-element-2d";

/**
 * Regresión portada de thesis-structures/src/programs/armor2d/data/data1.ts
 * (mismo dato de ejemplo de la app original). Es una armadura estáticamente
 * indeterminada, poco práctica para resolver a mano — los valores esperados
 * salen de un script Node aislado (Gaussian elimination propia, sin
 * reutilizar código de este repo) que aplica la misma física (T·k·Tᵀ,
 * fuerza interna EA/L·[-cos,-sin,cos,sin]·u). Ver docs del plan de Fase 2
 * para la derivación completa.
 */
describe("System — regresión armadura 2D de 4 nodos / 6 barras", () => {
  it("reproduce los desplazamientos, reacciones y fuerzas internas esperados", () => {
    const area = 10 * 10 ** -4;
    const elasticity = 2 * 10 ** 7;

    const points = {
      v1: { id: "v1", x: 0, z: 0 },
      v2: { id: "v2", x: 3, z: 0 },
      v3: { id: "v3", x: 0, z: 4 },
      v4: { id: "v4", x: 3, z: 4 },
    };

    const system = new System(2);
    system.addNode({ id: "v1", restrained: [true, true] });
    system.addNode({ id: "v2", restrained: [true, true] });
    system.addNode({ id: "v3", restrained: [false, false], force: [4.8, -6.4] });
    system.addNode({ id: "v4", restrained: [false, false], force: [0, -6] });

    system.addElement(new TrussElement2D("e1", points.v1, points.v2, area, elasticity));
    system.addElement(new TrussElement2D("e2", points.v3, points.v4, area, elasticity));
    system.addElement(new TrussElement2D("e3", points.v1, points.v3, area, elasticity));
    system.addElement(new TrussElement2D("e4", points.v2, points.v4, area, elasticity));
    system.addElement(new TrussElement2D("e5", points.v1, points.v4, area, elasticity));
    system.addElement(new TrussElement2D("e6", points.v2, points.v3, area, elasticity));

    const { displacements, reactions, internalForces } = system.solve();

    expect(displacements.get("v3")![0]).toBeCloseTo(0.0025244444, 8);
    expect(displacements.get("v3")![1]).toBeCloseTo(-0.0002054321, 8);
    expect(displacements.get("v4")![0]).toBeCloseTo(0.0024088889, 8);
    expect(displacements.get("v4")![1]).toBeCloseTo(-0.0014054321, 8);

    expect(reactions.get("v1")![0]).toBeCloseTo(-0.7703703704, 6);
    expect(reactions.get("v1")![1]).toBeCloseTo(0, 6);
    expect(reactions.get("v2")![0]).toBeCloseTo(-4.0296296296, 6);
    expect(reactions.get("v2")![1]).toBeCloseTo(12.4, 6);

    // Equilibrio global: suma de fuerzas aplicadas + reacciones = 0 en cada eje.
    const sumFx = 4.8 + 0 + reactions.get("v1")![0] + reactions.get("v2")![0];
    const sumFz = -6.4 + -6 + reactions.get("v1")![1] + reactions.get("v2")![1];
    expect(sumFx).toBeCloseTo(0, 6);
    expect(sumFz).toBeCloseTo(0, 6);

    const axial = (id: string) => (internalForces.get(id) as { axialForce: number }).axialForce;
    expect(axial("e1")).toBeCloseTo(0, 6);
    expect(axial("e2")).toBeCloseTo(-0.7703703704, 6);
    expect(axial("e3")).toBeCloseTo(-1.0271604938, 6);
    expect(axial("e4")).toBeCloseTo(-7.0271604938, 6);
    expect(axial("e5")).toBeCloseTo(1.2839506173, 6);
    expect(axial("e6")).toBeCloseTo(-6.7160493827, 6);
  });
});
