import { describe, expect, it } from "vitest";
import { System } from "../system";
import { FrameElement2D } from "./frame-element-2d";

describe("FrameElement2D — sanity de una barra", () => {
  const point = (id: string, x: number, z: number) => ({ id, x, z });

  it("deja la rigidez global igual a la local cuando la barra es horizontal", () => {
    const element = new FrameElement2D("e1", point("a", 0, 0), point("b", 2, 0), 1, 10, 5);
    const global = element.stiffness();
    const local = element.localStiffness();

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        expect(global[i][j]).toBeCloseTo(local[i][j], 9);
      }
    }
  });

  it("mantiene la rigidez global simétrica en una barra inclinada", () => {
    const element = new FrameElement2D("e1", point("a", 0, 0), point("b", 3, 4), 1, 10, 5);
    const k = element.stiffness();

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < i; j++) {
        expect(k[i][j]).toBeCloseTo(k[j][i], 9);
      }
    }
  });

  it("reproduce la flecha y el giro de una ménsula con carga en el extremo", () => {
    const length = 2;
    const elasticity = 200;
    const inertia = 3;
    const load = 7;
    const ei = elasticity * inertia;

    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, true] });
    system.addNode({ id: "b", restrained: [false, false, false], force: [0, load, 0] });
    system.addElement(
      new FrameElement2D("e1", point("a", 0, 0), point("b", length, 0), 1, elasticity, inertia),
    );

    const { displacements, reactions, internalForces } = system.solve();

    expect(displacements.get("b")![0]).toBeCloseTo(0, 9);
    expect(displacements.get("b")![1]).toBeCloseTo((load * length ** 3) / (3 * ei), 9);
    expect(displacements.get("b")![2]).toBeCloseTo((load * length ** 2) / (2 * ei), 9);

    // Empotramiento: fuerza opuesta a la carga y momento de vuelco P·L.
    expect(reactions.get("a")![1]).toBeCloseTo(-load, 9);
    expect(reactions.get("a")![2]).toBeCloseTo(-load * length, 9);

    const forces = internalForces.get("e1") as ReturnType<FrameElement2D["internalForce"]>;
    expect(forces.from.axial).toBeCloseTo(0, 9);
    expect(forces.from.shear).toBeCloseTo(-load, 9);
    expect(forces.from.moment).toBeCloseTo(-load * length, 9);
    expect(forces.to.shear).toBeCloseTo(load, 9);
    expect(forces.to.moment).toBeCloseTo(0, 9);
  });

  it("se reduce al caso axial puro cuando solo se libera el eje de la barra", () => {
    const area = 2;
    const elasticity = 10;
    const length = 4;
    const force = 6;
    const eaOverL = (elasticity * area) / length;

    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, true] });
    system.addNode({ id: "b", restrained: [false, true, true], force: [force, 0, 0] });
    system.addElement(
      new FrameElement2D("e1", point("a", 0, 0), point("b", length, 0), area, elasticity, 5),
    );

    const { displacements, internalForces } = system.solve();

    expect(displacements.get("b")![0]).toBeCloseTo(force / eaOverL, 9);

    const forces = internalForces.get("e1") as ReturnType<FrameElement2D["internalForce"]>;
    expect(forces.to.axial).toBeCloseTo(force, 9);
    expect(forces.to.shear).toBeCloseTo(0, 9);
    expect(forces.to.moment).toBeCloseTo(0, 9);
  });

  it("reparte una carga distribuida como reacciones y momentos de empotramiento", () => {
    // Convención del FEM (la misma de las tablas del proyecto original):
    // q positivo = carga hacia el lado −w local, o sea hacia abajo en una barra
    // horizontal. FEM = [0, qL/2, qL²/12, 0, qL/2, −qL²/12].
    const q = 6;
    const length = 4;
    const shear = (q * length) / 2; // 12
    const moment = (q * length ** 2) / 12; // 8

    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, true] });
    system.addNode({ id: "b", restrained: [true, true, true] });
    system.addElement(
      new FrameElement2D("e1", point("a", 0, 0), point("b", length, 0), 1, 200, 3, {
        from: { axial: 0, shear, moment },
        to: { axial: 0, shear, moment: -moment },
      }),
    );

    const { displacements, reactions, internalForces } = system.solve();

    // Ambos extremos empotrados: no hay nada que resolver, u = 0.
    expect(displacements.get("a")!.every((value) => value === 0)).toBe(true);
    expect(displacements.get("b")!.every((value) => value === 0)).toBe(true);

    // Cada apoyo levanta la mitad de la carga total qL, y el momento de
    // empotramiento sale con signos opuestos en los dos extremos.
    expect(reactions.get("a")![1]).toBeCloseTo(shear, 9);
    expect(reactions.get("b")![1]).toBeCloseTo(shear, 9);
    expect(reactions.get("a")![2]).toBeCloseTo(moment, 9);
    expect(reactions.get("b")![2]).toBeCloseTo(-moment, 9);

    // Con u = 0, la fuerza interna es exactamente el FEM.
    const forces = internalForces.get("e1") as ReturnType<FrameElement2D["internalForce"]>;
    expect(forces.from.shear).toBeCloseTo(shear, 9);
    expect(forces.from.moment).toBeCloseTo(moment, 9);
    expect(forces.to.moment).toBeCloseTo(-moment, 9);
  });

  it("transforma la carga distribuida de una columna a ejes globales", () => {
    // Este es el caso que el proyecto original resolvía mal: en una barra
    // vertical, T ya no es la identidad. La carga es perpendicular a la barra,
    // así que tiene que salir horizontal (eje x global) y NO vertical.
    const q = 6;
    const length = 4;
    const shear = (q * length) / 2;
    const moment = (q * length ** 2) / 12;

    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, true] });
    system.addNode({ id: "b", restrained: [true, true, true] });
    system.addElement(
      new FrameElement2D("e1", point("a", 0, 0), point("b", 0, length), 1, 200, 3, {
        from: { axial: 0, shear, moment },
        to: { axial: 0, shear, moment: -moment },
      }),
    );

    const { reactions } = system.solve();

    expect(Math.abs(reactions.get("a")![0])).toBeCloseTo(shear, 9);
    expect(reactions.get("a")![1]).toBeCloseTo(0, 9);
    expect(Math.abs(reactions.get("b")![0])).toBeCloseTo(shear, 9);
    expect(reactions.get("b")![1]).toBeCloseTo(0, 9);
  });

  it("anula el momento en los extremos de una viga simplemente apoyada", () => {
    // Prueba de punta a punta de la superposición: acá k·u ya no es cero y
    // tiene que cancelar exactamente el qL²/12 del FEM, porque una rótula no
    // puede transmitir momento.
    const q = 6;
    const length = 4;
    const elasticity = 200;
    const inertia = 3;
    const ei = elasticity * inertia;
    const shear = (q * length) / 2;
    const moment = (q * length ** 2) / 12;

    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, false] });
    system.addNode({ id: "b", restrained: [true, true, false] });
    system.addElement(
      new FrameElement2D("e1", point("a", 0, 0), point("b", length, 0), 1, elasticity, inertia, {
        from: { axial: 0, shear, moment },
        to: { axial: 0, shear, moment: -moment },
      }),
    );

    const { displacements, reactions, internalForces } = system.solve();

    const forces = internalForces.get("e1") as ReturnType<FrameElement2D["internalForce"]>;
    expect(forces.from.moment).toBeCloseTo(0, 9);
    expect(forces.to.moment).toBeCloseTo(0, 9);

    // Los apoyos siguen llevando qL/2 cada uno.
    expect(reactions.get("a")![1]).toBeCloseTo(shear, 9);
    expect(reactions.get("b")![1]).toBeCloseTo(shear, 9);

    // Giros de extremo de la viga simplemente apoyada: ±qL³/(24EI), opuestos.
    const expectedRotation = (q * length ** 3) / (24 * ei);
    expect(Math.abs(displacements.get("a")![2])).toBeCloseTo(expectedRotation, 9);
    expect(displacements.get("b")![2]).toBeCloseTo(-displacements.get("a")![2], 9);
  });

  it("rechaza propiedades de sección no positivas", () => {
    const p1 = point("a", 0, 0);
    const p2 = point("b", 1, 0);
    expect(() => new FrameElement2D("e1", p1, p2, 0, 10, 5)).toThrow(/área positiva/);
    expect(() => new FrameElement2D("e1", p1, p2, 1, 0, 5)).toThrow(/elasticidad positivo/);
    expect(() => new FrameElement2D("e1", p1, p2, 1, 10, 0)).toThrow(/inercia positivo/);
  });

  it("rechaza barras de longitud cero", () => {
    const p = point("a", 1, 1);
    expect(() => new FrameElement2D("e1", p, { ...p, id: "b" }, 1, 10, 5)).toThrow(/longitud cero/);
  });
});
