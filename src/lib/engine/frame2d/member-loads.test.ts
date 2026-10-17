import { describe, expect, it } from "vitest";
import { System } from "../system";
import { FrameElement2D } from "./frame-element-2d";
import {
  loadFixedEndForces,
  memberAxis,
  memberLoadProblem,
  sumFixedEndForces,
  type MemberAxis,
  type MemberLoad,
} from "./member-loads";
import type { FrameFixedEndForces } from "./frame-element-2d";

/**
 * Los valores esperados salen de las **tablas de momentos de empotramiento
 * perfecto** de los textos (Hibbeler, Beer), no del código: la rutina integra
 * contra las funciones de forma y estos tests comprueban que eso reproduce las
 * tablas. Convención del FEM: la reacción del empotramiento, en ejes locales,
 * momento antihorario positivo. Una carga hacia abajo sobre una barra
 * horizontal es `y'` negativa y da cortes FEM positivos.
 */

const L = 5;
const horizontal: MemberAxis = { length: L, cos: 1, sin: 0 };

function expectFem(actual: FrameFixedEndForces, expected: FrameFixedEndForces, digits = 9) {
  for (const end of ["from", "to"] as const) {
    for (const key of ["axial", "shear", "moment"] as const) {
      expect(actual[end][key], `${end}.${key}`).toBeCloseTo(expected[end][key], digits);
    }
  }
}

const fem = (from: [number, number, number], to: [number, number, number]): FrameFixedEndForces => ({
  from: { axial: from[0], shear: from[1], moment: from[2] },
  to: { axial: to[0], shear: to[1], moment: to[2] },
});

describe("loadFixedEndForces — las tablas de los libros", () => {
  it("carga uniforme en toda la barra: qL/2 y qL²/12", () => {
    const load: MemberLoad = { kind: "distributed", direction: "perpendicular", q1: -10, q2: -10, a: 0, b: L };
    expectFem(loadFixedEndForces(load, horizontal), fem([0, 25, 250 / 12], [0, 25, -250 / 12]));
  });

  it("carga uniforme parcial: coincide con la fórmula del original, que era correcta", () => {
    // w = 10 hacia abajo entre a = 1 y b = 3 (verificado aparte integrando cargas puntuales).
    const load: MemberLoad = { kind: "distributed", direction: "perpendicular", q1: -10, q2: -10, a: 1, b: 3 };
    expectFem(loadFixedEndForces(load, horizontal), fem([0, 12.8, 40 / 3], [0, 7.2, -28 / 3]));
  });

  it("carga triangular de 0 a q: 3qL/20, 7qL/20, qL²/30 y qL²/20", () => {
    const load: MemberLoad = { kind: "distributed", direction: "perpendicular", q1: 0, q2: -10, a: 0, b: L };
    expectFem(loadFixedEndForces(load, horizontal), fem([0, 7.5, 250 / 30], [0, 17.5, -250 / 20]));
  });

  it("carga puntual: Pb²(L+2a)/L³, Pab²/L² y sus simétricos", () => {
    const load: MemberLoad = { kind: "point", direction: "perpendicular", value: -10, a: 1 };
    expectFem(loadFixedEndForces(load, horizontal), fem([0, 8.96, 6.4], [0, 1.04, -1.6]));
  });

  it("momento concentrado: 6Mab/L³, Mb(2a−b)/L² y Ma(2b−a)/L²", () => {
    // M = 10 horario en a = 1, b = 4. Es el caso que el original calculaba mal
    // en el extremo j (daba 11.2 donde va −2.8; V2 de docs/frame2d-v1.md).
    const load: MemberLoad = { kind: "moment", value: -10, a: 1 };
    expectFem(loadFixedEndForces(load, horizontal), fem([0, -1.92, 3.2], [0, 1.92, -2.8]));
  });

  it("un momento aplicado sobre el extremo lo toma entero ese empotramiento", () => {
    const load: MemberLoad = { kind: "moment", value: 7, a: 0 };
    expectFem(loadFixedEndForces(load, horizontal), fem([0, 0, -7], [0, 0, 0]));
  });

  it("carga axial uniforme: la mitad a cada extremo, en contra de la carga", () => {
    const load: MemberLoad = { kind: "distributed", direction: "axial", q1: 4, q2: 4, a: 0, b: L };
    expectFem(loadFixedEndForces(load, horizontal), fem([-10, 0, 0], [-10, 0, 0]));
  });
});

describe("loadFixedEndForces — direcciones globales", () => {
  // Barra 3-4-5: c = 0.6, s = 0.8.
  const inclined = memberAxis({ x: 0, z: 0 }, { x: 3, z: 4 });

  it("la gravedad sobre una barra inclinada se descompone en axial y perpendicular", () => {
    const load: MemberLoad = { kind: "distributed", direction: "globalZ", q1: -10, q2: -10, a: 0, b: 5 };
    // x' = s·q = −8 por metro (axial), y' = c·q = −6 por metro (perpendicular).
    expectFem(loadFixedEndForces(load, inclined), fem([20, 15, 12.5], [20, 15, -12.5]));
  });

  it("por proyección, la carga total es q por el largo en planta, no por el largo de la barra", () => {
    const load: MemberLoad = {
      kind: "distributed",
      direction: "globalZ",
      q1: -10,
      q2: -10,
      a: 0,
      b: 5,
      projected: true,
    };
    const result = loadFixedEndForces(load, inclined);
    expectFem(result, fem([12, 9, 7.5], [12, 9, -7.5]));

    // Las reacciones verticales del empotramiento suman q·(largo en planta) = 10·3.
    const vertical = (end: "from" | "to") => 0.8 * result[end].axial + 0.6 * result[end].shear;
    expect(vertical("from") + vertical("to")).toBeCloseTo(30, 9);
  });

  it("una carga horizontal +X sobre una columna empuja hacia −y'", () => {
    // Columna hacia arriba: y' (a la izquierda subiendo) es −X. Así que +X es
    // −y', el mismo caso que una carga hacia abajo sobre una viga: P/2 y ±PL/8.
    const column = memberAxis({ x: 0, z: 0 }, { x: 0, z: 4 });
    const load: MemberLoad = { kind: "point", direction: "globalX", value: 6, a: 2 };
    expectFem(loadFixedEndForces(load, column), fem([0, 3, 3], [0, 3, -3]));
  });
});

describe("loadFixedEndForces — equilibrio con cargas cualesquiera", () => {
  /**
   * El FEM más las cargas aplicadas tienen que dejar la barra en equilibrio,
   * sea cual sea la carga: es la prueba que no depende de ninguna tabla. Las
   * resultantes se integran acá a fuerza bruta, sin funciones de forma.
   */
  function resultant(load: MemberLoad, axis: MemberAxis) {
    const { cos: c, sin: s } = axis;
    if (load.kind === "moment") return { fx: 0, fy: 0, moment: load.value };
    const dir = { perpendicular: [0, 1], axial: [1, 0], globalX: [c, -s], globalZ: [s, c] }[load.direction];
    if (load.kind === "point") {
      return { fx: dir[0] * load.value, fy: dir[1] * load.value, moment: dir[1] * load.value * load.a };
    }
    const factor = load.projected ? (load.direction === "globalZ" ? Math.abs(c) : load.direction === "globalX" ? Math.abs(s) : 1) : 1;
    const n = 20000;
    const dx = (load.b - load.a) / n;
    let fx = 0;
    let fy = 0;
    let moment = 0;
    for (let k = 0; k < n; k++) {
      const x = load.a + (k + 0.5) * dx;
      const q = factor * (load.q1 + ((load.q2 - load.q1) * (x - load.a)) / (load.b - load.a));
      fx += dir[0] * q * dx;
      fy += dir[1] * q * dx;
      moment += dir[1] * q * dx * x;
    }
    return { fx, fy, moment };
  }

  const axes = [horizontal, memberAxis({ x: 1, z: 2 }, { x: -3, z: 7 }), memberAxis({ x: 0, z: 0 }, { x: 0, z: -3 })];
  const loads: MemberLoad[] = [
    { kind: "distributed", direction: "perpendicular", q1: 3, q2: -7, a: 0.4, b: 2.9 },
    { kind: "distributed", direction: "globalX", q1: -2, q2: 5, a: 0, b: 3, projected: true },
    { kind: "distributed", direction: "globalZ", q1: -4, q2: -1, a: 1, b: 2.5 },
    { kind: "distributed", direction: "axial", q1: 1, q2: 6, a: 0.5, b: 2 },
    { kind: "point", direction: "globalX", value: 9, a: 2.2 },
    { kind: "point", direction: "globalZ", value: -4, a: 0.3 },
    { kind: "moment", value: 11, a: 1.7 },
  ];

  for (const [i, axis] of axes.entries()) {
    for (const load of loads) {
      it(`barra ${i + 1}, ${load.kind} ${"direction" in load ? load.direction : ""}`, () => {
        const r = loadFixedEndForces(load, axis);
        const applied = resultant(load, axis);
        expect(r.from.axial + r.to.axial + applied.fx).toBeCloseTo(0, 6);
        expect(r.from.shear + r.to.shear + applied.fy).toBeCloseTo(0, 6);
        // Momentos respecto del extremo «desde».
        expect(r.from.moment + r.to.moment + r.to.shear * axis.length + applied.moment).toBeCloseTo(0, 6);
      });
    }
  }
});

describe("memberLoadProblem — lo que no tiene sentido se rechaza", () => {
  it("una posición fuera de la barra", () => {
    expect(memberLoadProblem({ kind: "point", direction: "perpendicular", value: 1, a: 6 }, horizontal)).toBe(
      "está en a = 6, fuera de la barra (el largo de la barra es L = 5).",
    );
    expect(() => loadFixedEndForces({ kind: "moment", value: 1, a: -1 }, horizontal)).toThrow(
      "La carga está en a = -1, fuera de la barra",
    );
  });

  it("una distribuida que termina antes de empezar, o en el mismo punto", () => {
    const load = (a: number, b: number): MemberLoad => ({
      kind: "distributed",
      direction: "perpendicular",
      q1: 1,
      q2: 1,
      a,
      b,
    });
    expect(memberLoadProblem(load(3, 1), horizontal)).toBe("tiene que terminar después de empezar (a = 3, b = 1).");
    expect(memberLoadProblem(load(2, 2), horizontal)).not.toBeNull();
    expect(memberLoadProblem(load(0, 5.5), horizontal)).toBe(
      "termina en b = 5.5, fuera de la barra (el largo de la barra es L = 5).",
    );
  });

  it("acepta los extremos exactos, aunque L venga con ruido de punto flotante", () => {
    const axis = memberAxis({ x: 0, z: 0 }, { x: 0.1 + 0.2, z: 0 });
    expect(memberLoadProblem({ kind: "point", direction: "perpendicular", value: 1, a: 0.3 }, axis)).toBeNull();
  });

  it("un valor que no es un número", () => {
    expect(memberLoadProblem({ kind: "moment", value: Number.NaN, a: 1 }, horizontal)).toBe(
      "tiene un valor que no es un número.",
    );
  });
});

describe("cargas en barras resueltas con System", () => {
  const E = 200;
  const I = 3;
  const A = 1;

  it("viga simplemente apoyada con carga uniforme: reacciones qL/2, momento nulo en los apoyos y giro qL³/24EI", () => {
    const q = 10;
    const a = { id: "a", x: 0, z: 0 };
    const b = { id: "b", x: L, z: 0 };
    const load = sumFixedEndForces([
      loadFixedEndForces({ kind: "distributed", direction: "globalZ", q1: -q, q2: -q, a: 0, b: L }, memberAxis(a, b)),
    ]);

    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, false] });
    system.addNode({ id: "b", restrained: [false, true, false] });
    system.addElement(new FrameElement2D("e", a, b, A, E, I, load));
    const { reactions, displacements, internalForces } = system.solve();

    expect(reactions.get("a")![1]).toBeCloseTo((q * L) / 2, 9);
    expect(reactions.get("b")![1]).toBeCloseTo((q * L) / 2, 9);
    expect(displacements.get("a")![2]).toBeCloseTo(-(q * L ** 3) / (24 * E * I), 9);
    expect(displacements.get("b")![2]).toBeCloseTo((q * L ** 3) / (24 * E * I), 9);
    const forces = internalForces.get("e") as ReturnType<FrameElement2D["internalForce"]>;
    expect(forces.from.moment).toBeCloseTo(0, 9);
    expect(forces.to.moment).toBeCloseTo(0, 9);
  });

  it("ménsula con carga puntual en el medio: el empotramiento toma P y P·L/2", () => {
    const P = 8;
    const a = { id: "a", x: 0, z: 0 };
    const b = { id: "b", x: L, z: 0 };
    const load = loadFixedEndForces({ kind: "point", direction: "globalZ", value: -P, a: L / 2 }, memberAxis(a, b));

    const system = new System(3);
    system.addNode({ id: "a", restrained: [true, true, true] });
    system.addNode({ id: "b", restrained: [false, false, false] });
    system.addElement(new FrameElement2D("e", a, b, A, E, I, load));
    const { reactions, displacements } = system.solve();

    expect(reactions.get("a")![1]).toBeCloseTo(P, 9);
    expect(reactions.get("a")![2]).toBeCloseTo((P * L) / 2, 9);
    // Flecha en la punta de una ménsula con P en el medio: 5PL³/48EI.
    expect(displacements.get("b")![1]).toBeCloseTo(-(5 * P * L ** 3) / (48 * E * I), 9);
  });
});
