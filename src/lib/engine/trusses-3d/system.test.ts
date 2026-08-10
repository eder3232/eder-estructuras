import { describe, expect, it } from "vitest";
import { System } from "../system";
import { TrussElement3D } from "./truss-element-3d";

/**
 * Regresión portada de thesis-structures/src/programs/armor3d/data/data1.ts
 * (el dato de ejemplo de la app original): armadura espacial de 4 nudos y 6
 * barras, con carga vertical en el nudo elevado y un **asentamiento prescrito**
 * de −0.01 en el apoyo `b` — el caso que ejercita la rama `Ur ≠ 0` del motor.
 *
 * El original nunca calculaba fuerzas internas acá (el `internalForces` de su
 * store se declaraba y quedaba vacío), así que esos valores no se pueden
 * cotejar contra la app vieja: salen de un script Node aislado (ensamblaje y
 * eliminación gaussiana propios, sin reutilizar código de este repo) que además
 * verifica equilibrio nudo por nudo.
 */
describe("System — regresión armadura 3D de 4 nodos / 6 barras", () => {
  it("reproduce los desplazamientos, reacciones y fuerzas internas esperados", () => {
    const area = 0.002;
    const elasticity = 20_000_000;

    const points = {
      a: { id: "a", x: 0, y: 0, z: 0 },
      b: { id: "b", x: 3.5, y: 0, z: 0 },
      c: { id: "c", x: 3.5, y: 2, z: 0 },
      d: { id: "d", x: 1.5, y: 1.2, z: 3 },
    };

    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, true] });
    system.addNode({ id: "b", restrained: [true, true, true], displacement: [0, 0, -0.01] });
    system.addNode({ id: "c", restrained: [false, false, true] });
    system.addNode({ id: "d", restrained: [false, false, false], force: [0, 0, -25] });

    system.addElement(new TrussElement3D("e1", points.a, points.b, area, elasticity));
    system.addElement(new TrussElement3D("e2", points.b, points.c, area, elasticity));
    system.addElement(new TrussElement3D("e3", points.a, points.c, area, elasticity));
    system.addElement(new TrussElement3D("e4", points.a, points.d, area, elasticity));
    system.addElement(new TrussElement3D("e5", points.b, points.d, area, elasticity));
    system.addElement(new TrussElement3D("e6", points.c, points.d, area, elasticity));

    const { displacements, reactions, internalForces } = system.solve();

    expect(displacements.get("c")![0]).toBeCloseTo(0.0013858335552, 10);
    expect(displacements.get("c")![1]).toBeCloseTo(-0.0000857142857, 10);
    expect(displacements.get("c")![2]).toBeCloseTo(0, 10);
    expect(displacements.get("d")![0]).toBeCloseTo(0.0064739040706, 10);
    expect(displacements.get("d")![1]).toBeCloseTo(-0.0095201104204, 10);
    expect(displacements.get("d")![2]).toBeCloseTo(-0.0012227816895, 10);

    // El asentamiento prescrito se devuelve tal cual en el nudo restringido.
    expect(displacements.get("b")![2]).toBeCloseTo(-0.01, 12);

    expect(reactions.get("a")!).toHaveLength(3);
    expect(reactions.get("a")![0]).toBeCloseTo(-2.8571428571, 8);
    expect(reactions.get("a")![1]).toBeCloseTo(0, 8);
    expect(reactions.get("a")![2]).toBeCloseTo(14.2857142857, 8);
    expect(reactions.get("b")![0]).toBeCloseTo(2.8571428571, 8);
    expect(reactions.get("b")![1]).toBeCloseTo(0, 8);
    expect(reactions.get("b")![2]).toBeCloseTo(-4.2857142857, 8);
    expect(reactions.get("c")![2]).toBeCloseTo(15, 8);
    // Los DOF libres de `c` no generan reacción.
    expect(reactions.get("c")![0]).toBe(0);
    expect(reactions.get("c")![1]).toBe(0);

    // Equilibrio global: aplicadas + reacciones = 0 en cada eje.
    for (const axis of [0, 1, 2]) {
      const applied = axis === 2 ? -25 : 0;
      const sum =
        applied +
        reactions.get("a")![axis] +
        reactions.get("b")![axis] +
        reactions.get("c")![axis] +
        reactions.get("d")![axis];
      expect(sum).toBeCloseTo(0, 8);
    }

    const axial = (id: string) => (internalForces.get(id) as { axialForce: number }).axialForce;
    expect(axial("e1")).toBeCloseTo(0, 8);
    expect(axial("e2")).toBeCloseTo(-1.7142857143, 8);
    expect(axial("e3")).toBeCloseTo(11.517511069, 8);
    expect(axial("e4")).toBeCloseTo(-16.9633458386, 8);
    expect(axial("e5")).toBeCloseTo(5.4285714286, 8);
    expect(axial("e6")).toBeCloseTo(-18.4661853126, 8);
  });
});
