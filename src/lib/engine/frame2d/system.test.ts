import { describe, expect, it } from "vitest";
import { System } from "../system";
import { FrameElement2D, type FrameInternalForce } from "./frame-element-2d";

/**
 * Regresión portada de thesis-structures/src/programs/frame2d/data/exampleReact2.ts
 * (el dato de ejemplo que la app original cargaba por defecto): pórtico de un
 * vano, dos columnas empotradas y una viga, con una carga horizontal de 5 en el
 * nudo superior derecho. El original lo modelaba en el plano x-y; acá se usa
 * x-z (z hacia arriba), consistente con el resto del motor.
 *
 * Igual que en trusses-2d/system.test.ts, los valores esperados salen de un
 * script Node aislado que reimplementa la física desde cero (ensamblaje,
 * eliminación gaussiana y k_local·T·u propios, sin reusar nada de este repo).
 * El resultado satisface equilibrio global de fuerzas y de momentos, y los
 * momentos de las barras que concurren en cada nudo libre se cancelan.
 */
describe("System — regresión pórtico 2D de 4 nudos / 3 barras", () => {
  it("reproduce los desplazamientos, reacciones y fuerzas internas esperados", () => {
    const elasticity = 15000 * Math.sqrt(210) * 10;
    const columnArea = 0.3 * 0.3;
    const columnInertia = (0.3 * 0.3 ** 3) / 12;
    const beamArea = 0.3 * 0.5;
    const beamInertia = (0.3 * 0.5 ** 3) / 12;

    const points = {
      v1: { id: "v1", x: 0, z: 0 },
      v2: { id: "v2", x: 0, z: 3.5 },
      v3: { id: "v3", x: 5, z: 3.5 },
      v4: { id: "v4", x: 5, z: 0 },
    };

    const system = new System(3);
    system.addNode({ id: "v1", restrained: [true, true, true] });
    system.addNode({ id: "v2", restrained: [false, false, false] });
    system.addNode({ id: "v3", restrained: [false, false, false], force: [5, 0, 0] });
    system.addNode({ id: "v4", restrained: [true, true, true] });

    system.addElement(
      new FrameElement2D("e1", points.v1, points.v2, columnArea, elasticity, columnInertia),
    );
    system.addElement(
      new FrameElement2D("e2", points.v2, points.v3, beamArea, elasticity, beamInertia),
    );
    system.addElement(
      new FrameElement2D("e3", points.v3, points.v4, columnArea, elasticity, columnInertia),
    );

    const { displacements, reactions, internalForces } = system.solve();

    expect(displacements.get("v2")![0]).toBeCloseTo(6.9817601065e-3, 10);
    expect(displacements.get("v2")![1]).toBeCloseTo(2.9743188487e-5, 10);
    expect(displacements.get("v2")![2]).toBeCloseTo(-5.1865245855e-4, 10);
    expect(displacements.get("v3")![0]).toBeCloseTo(7.0200111139e-3, 10);
    expect(displacements.get("v3")![1]).toBeCloseTo(-2.9743188487e-5, 10);
    expect(displacements.get("v3")![2]).toBeCloseTo(-5.2490855466e-4, 10);

    expect(reactions.get("v1")![0]).toBeCloseTo(-2.4943939159, 8);
    expect(reactions.get("v1")![1]).toBeCloseTo(-1.66250475, 8);
    expect(reactions.get("v1")![2]).toBeCloseTo(4.5826161537, 8);
    expect(reactions.get("v4")![0]).toBeCloseTo(-2.5056060841, 8);
    expect(reactions.get("v4")![1]).toBeCloseTo(1.66250475, 8);
    expect(reactions.get("v4")![2]).toBeCloseTo(4.6048600963, 8);

    // Equilibrio global: fuerzas en cada eje y momentos respecto del origen.
    const sumFx = 5 + reactions.get("v1")![0] + reactions.get("v4")![0];
    const sumFz = reactions.get("v1")![1] + reactions.get("v4")![1];
    const sumM =
      -5 * 3.5 +
      reactions.get("v1")![2] +
      reactions.get("v4")![2] +
      5 * reactions.get("v4")![1];
    expect(sumFx).toBeCloseTo(0, 8);
    expect(sumFz).toBeCloseTo(0, 8);
    expect(sumM).toBeCloseTo(0, 8);

    const forces = (id: string) => internalForces.get(id) as FrameInternalForce;

    expect(forces("e1").from.axial).toBeCloseTo(-1.66250475, 8);
    expect(forces("e1").from.shear).toBeCloseTo(2.4943939159, 8);
    expect(forces("e1").from.moment).toBeCloseTo(4.5826161537, 8);
    expect(forces("e1").to.moment).toBeCloseTo(4.147762552, 8);

    expect(forces("e2").from.axial).toBeCloseTo(-2.4943939159, 8);
    expect(forces("e2").from.shear).toBeCloseTo(-1.66250475, 8);
    expect(forces("e2").to.moment).toBeCloseTo(-4.1647611981, 8);

    expect(forces("e3").from.axial).toBeCloseTo(1.66250475, 8);
    expect(forces("e3").from.shear).toBeCloseTo(2.5056060841, 8);
    expect(forces("e3").to.moment).toBeCloseTo(4.6048600963, 8);

    // Equilibrio de momentos en los nudos libres: lo que llega por una barra
    // sale por la otra.
    expect(forces("e1").to.moment + forces("e2").from.moment).toBeCloseTo(0, 8);
    expect(forces("e2").to.moment + forces("e3").from.moment).toBeCloseTo(0, 8);
  });
});
