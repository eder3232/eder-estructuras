import { describe, expect, it } from "vitest";
import { System } from "../system";
import { TrussElement2D } from "../trusses-2d/truss-element-2d";
import { TrussElement3D } from "./truss-element-3d";

describe("TrussElement3D + System — sanity de 1 barra oblicua", () => {
  /**
   * El desplazamiento se **prescribe** en vez de aplicar una fuerza: una barra
   * de armadura sola no tiene ninguna rigidez en las dos direcciones
   * perpendiculares a su eje, así que un nudo libre en los 3 DOF colgado de una
   * única barra deja `Kff` singular. Es física correcta, no una limitación del
   * motor — estabilizarlo pide como mínimo un trípode de 3 barras no coplanares
   * (eso lo cubre la regresión de `system.test.ts`).
   */
  it("un alargamiento impuesto se reparte según los cosenos directores", () => {
    // Barra (0,0,0)→(1,2,2): L = 3, cosenos directores (1/3, 2/3, 2/3).
    const area = 1;
    const elasticity = 9;
    const eaOverL = 3; // (9 * 1) / 3
    const elongation = 3;
    // Desplazamiento colineal con la barra: 3 · (1/3, 2/3, 2/3).
    const displacement = [1, 2, 2];

    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, true] });
    system.addNode({ id: "b", restrained: [true, true, true], displacement });
    system.addElement(
      new TrussElement3D("e1", { id: "a", x: 0, y: 0, z: 0 }, { id: "b", x: 1, y: 2, z: 2 }, area, elasticity),
    );

    const { reactions, internalForces } = system.solve();

    // Tracción N = (EA/L) · alargamiento = 9, y las reacciones son N · cosenos.
    expect((internalForces.get("e1") as { axialForce: number }).axialForce).toBeCloseTo(
      eaOverL * elongation,
      6,
    );

    expect(reactions.get("a")![0]).toBeCloseTo(-3, 6);
    expect(reactions.get("a")![1]).toBeCloseTo(-6, 6);
    expect(reactions.get("a")![2]).toBeCloseTo(-6, 6);
    expect(reactions.get("b")![0]).toBeCloseTo(3, 6);
    expect(reactions.get("b")![1]).toBeCloseTo(6, 6);
    expect(reactions.get("b")![2]).toBeCloseTo(6, 6);
  });

  it("un desplazamiento perpendicular al eje no genera fuerza axial (en teoría de primer orden)", () => {
    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, true] });
    // Barra a lo largo de x; el nudo b se mueve solo en y y z.
    system.addNode({ id: "b", restrained: [true, true, true], displacement: [0, 0.5, -0.3] });
    system.addElement(
      new TrussElement3D("e1", { id: "a", x: 0, y: 0, z: 0 }, { id: "b", x: 2, y: 0, z: 0 }, 1, 10),
    );

    const { reactions, internalForces } = system.solve();

    expect((internalForces.get("e1") as { axialForce: number }).axialForce).toBeCloseTo(0, 10);
    for (const axis of [0, 1, 2]) {
      expect(reactions.get("a")![axis]).toBeCloseTo(0, 10);
      expect(reactions.get("b")![axis]).toBeCloseTo(0, 10);
    }
  });

  it("coincide con TrussElement2D cuando la barra vive en el plano y = 0", () => {
    const area = 3;
    const elasticity = 7;
    const bar3d = new TrussElement3D(
      "e1",
      { id: "a", x: 1, y: 0, z: 2 },
      { id: "b", x: 4, y: 0, z: 6 },
      area,
      elasticity,
    );
    const bar2d = new TrussElement2D("e1", { id: "a", x: 1, z: 2 }, { id: "b", x: 4, z: 6 }, area, elasticity);

    // Se descartan las filas/columnas del DOF y (índices 1 y 4) del 6×6.
    const planar = [0, 2, 3, 5];
    const reduced = planar.map((i) => planar.map((j) => bar3d.stiffness()[i][j]));

    reduced.forEach((row, i) => {
      row.forEach((value, j) => {
        expect(value).toBeCloseTo(bar2d.stiffness()[i][j], 10);
      });
    });

    const u3d: [number[], number[]] = [
      [0.1, 0, -0.2],
      [0.3, 0, 0.4],
    ];
    const u2d: [number[], number[]] = [
      [0.1, -0.2],
      [0.3, 0.4],
    ];
    expect(bar3d.internalForce(u3d).axialForce).toBeCloseTo(bar2d.internalForce(u2d).axialForce, 10);
  });

  it("rechaza área o módulo de elasticidad no positivos", () => {
    const p1 = { id: "a", x: 0, y: 0, z: 0 };
    const p2 = { id: "b", x: 1, y: 0, z: 0 };
    expect(() => new TrussElement3D("e1", p1, p2, 0, 10)).toThrow(/área positiva/);
    expect(() => new TrussElement3D("e1", p1, p2, 1, 0)).toThrow(/elasticidad positivo/);
  });

  it("rechaza barras de longitud cero", () => {
    const p = { id: "a", x: 1, y: 2, z: 3 };
    expect(() => new TrussElement3D("e1", p, { ...p, id: "b" }, 1, 10)).toThrow(/longitud cero/);
  });
});
