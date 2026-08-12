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

/**
 * `breakdown()` existe para que la página pueda mostrar el paso de
 * transformación. Lo que estos tests fijan es justamente eso: que lo que se
 * muestra sea lo que se calcula, y no una segunda implementación que puede
 * divergir sin que nadie se entere.
 */
describe("TrussElement2D.breakdown", () => {
  // Barra a 3-4-5: longitud 5, cos 0.6, sin 0.8. Ningún valor redondo por
  // casualidad, así que un eje cruzado se nota.
  const element = new TrussElement2D("e1", { id: "a", x: 0, z: 0 }, { id: "b", x: 3, z: 4 }, 2, 100);

  it("expone la geometría que usa para calcular", () => {
    const { length, cos, sin, eaOverL } = element.breakdown();
    expect(length).toBeCloseTo(5, 12);
    expect(cos).toBeCloseTo(0.6, 12);
    expect(sin).toBeCloseTo(0.8, 12);
    expect(eaOverL).toBeCloseTo((100 * 2) / 5, 12);
  });

  it("es la fuente de `stiffness()`, no una copia", () => {
    expect(element.breakdown().globalStiffness).toEqual(element.stiffness());
  });

  it("multiplicar A · k · Aᵀ a mano reproduce la matriz global", () => {
    const { transform, localStiffness, globalStiffness } = element.breakdown();

    const manual = transform.map((rowA) =>
      transform.map((rowB) =>
        // (A · k · Aᵀ)[i][j] = Σ_p Σ_q A[i][p] · k[p][q] · A[j][q]
        localStiffness.reduce(
          (total, kRow, p) =>
            total + kRow.reduce((inner, kValue, q) => inner + rowA[p] * kValue * rowB[q], 0),
          0,
        ),
      ),
    );

    manual.forEach((row, i) => row.forEach((value, j) => expect(globalStiffness[i][j]).toBeCloseTo(value, 10)));
  });

  it("la rigidez local es EA/L·[[1,−1],[−1,1]] y A tiene los cosenos directores", () => {
    const { transform, transformTransposed, localStiffness, eaOverL, cos, sin } = element.breakdown();

    expect(transformTransposed).toEqual([
      [cos, sin, 0, 0],
      [0, 0, cos, sin],
    ]);

    expect(localStiffness).toEqual([
      [eaOverL, -eaOverL],
      [-eaOverL, eaOverL],
    ]);
    expect(transform).toEqual([
      [cos, 0],
      [sin, 0],
      [0, cos],
      [0, sin],
    ]);
  });
});
