import { describe, expect, it } from "vitest";
import { System } from "../system";
import { FrameElement2D, type FrameInternalForce } from "./frame-element-2d";
import { beamConventionEnds, memberDiagram, type MemberDiagram } from "./member-diagrams";
import { loadFixedEndForces, memberAxis, sumFixedEndForces, type MemberLoad } from "./member-loads";

/**
 * Los valores esperados son los de los libros (Hibbeler, Beer) para vigas que
 * tienen solución cerrada; el caso del pórtico con cargas mezcladas no tiene
 * tabla, y ahí la prueba es el **cierre**: el diagrama, que arranca en «desde»
 * y suma cargas, tiene que llegar a lo que el motor dio en «hacia».
 */

const E = 200;
const I = 3;
const A = 1;
const L = 6;

type Point = { id: string; x: number; z: number };

/** Resuelve una sola barra con sus cargas y devuelve su diagrama. */
function solveBeam(
  restraints: { a: [boolean, boolean, boolean]; b: [boolean, boolean, boolean] },
  loads: MemberLoad[],
  a: Point = { id: "a", x: 0, z: 0 },
  b: Point = { id: "b", x: L, z: 0 },
): MemberDiagram {
  const axis = memberAxis(a, b);
  const fem = sumFixedEndForces(loads.map((load) => loadFixedEndForces(load, axis)));
  const system = new System(3);
  system.addNode({ id: a.id, restrained: restraints.a });
  system.addNode({ id: b.id, restrained: restraints.b });
  system.addElement(new FrameElement2D("e", a, b, A, E, I, fem));
  const forces = system.solve().internalForces.get("e") as FrameInternalForce;
  return memberDiagram(forces, loads, axis);
}

const pin: [boolean, boolean, boolean] = [true, true, false];
const roller: [boolean, boolean, boolean] = [false, true, false];
const fixed: [boolean, boolean, boolean] = [true, true, true];
const free: [boolean, boolean, boolean] = [false, false, false];

/** El valor de un esfuerzo justo en `x` (a la derecha si hay salto). */
function valueAt(diagram: MemberDiagram, x: number, key: "N" | "V" | "M") {
  const candidates = diagram.points.filter((p) => Math.abs(p.x - x) < 1e-9);
  return candidates[candidates.length - 1][key];
}

function expectClosed(diagram: MemberDiagram) {
  expect(diagram.closure.N).toBeCloseTo(0, 8);
  expect(diagram.closure.V).toBeCloseTo(0, 8);
  expect(diagram.closure.M).toBeCloseTo(0, 8);
}

describe("memberDiagram — vigas de libro", () => {
  it("simplemente apoyada con carga uniforme: V = ±qL/2 y M máximo qL²/8 en el centro, positivo", () => {
    const q = 10;
    const d = solveBeam({ a: pin, b: roller }, [
      { kind: "distributed", direction: "globalZ", q1: -q, q2: -q, a: 0, b: L },
    ]);
    expectClosed(d);
    expect(valueAt(d, 0, "V")).toBeCloseTo((q * L) / 2, 9);
    expect(valueAt(d, L, "V")).toBeCloseTo((-q * L) / 2, 9);
    expect(valueAt(d, 0, "M")).toBeCloseTo(0, 9);

    const extremum = d.keyPoints.filter((k) => k.kind === "extremum");
    expect(extremum).toHaveLength(1);
    expect(extremum[0].x).toBeCloseTo(L / 2, 9);
    expect(extremum[0].left.M).toBeCloseTo((q * L ** 2) / 8, 9);
  });

  it("biempotrada con carga puntual al centro: −PL/8 en los apoyos, +PL/8 al centro, y V salta P", () => {
    const P = 12;
    const d = solveBeam({ a: fixed, b: fixed }, [{ kind: "point", direction: "globalZ", value: -P, a: L / 2 }]);
    expectClosed(d);
    expect(valueAt(d, 0, "M")).toBeCloseTo((-P * L) / 8, 9);
    expect(valueAt(d, L, "M")).toBeCloseTo((-P * L) / 8, 9);
    expect(valueAt(d, L / 2, "M")).toBeCloseTo((P * L) / 8, 9);

    const jump = d.keyPoints.find((k) => k.kind === "jump")!;
    expect(jump.x).toBeCloseTo(L / 2, 9);
    expect(jump.left.V).toBeCloseTo(P / 2, 9);
    expect(jump.right.V).toBeCloseTo(-P / 2, 9);
  });

  it("ménsula con un momento concentrado: M salta el valor del momento y V es cero", () => {
    const M0 = 9;
    const d = solveBeam({ a: fixed, b: free }, [{ kind: "moment", value: M0, a: 2 }]);
    expectClosed(d);
    const jump = d.keyPoints.find((k) => k.kind === "jump")!;
    expect(jump.x).toBe(2);
    // Un momento antihorario aplicado: a su izquierda la ménsula lo resiste, a su derecha no queda nada.
    expect(jump.right.M).toBeCloseTo(0, 9);
    expect(jump.left.M - jump.right.M).toBeCloseTo(M0, 9);
    for (const p of d.points) expect(p.V).toBeCloseTo(0, 9);
  });

  it("simplemente apoyada con carga triangular: M máximo qL²/(9√3) en x = L/√3", () => {
    const q = 10;
    const d = solveBeam({ a: pin, b: roller }, [
      { kind: "distributed", direction: "perpendicular", q1: 0, q2: -q, a: 0, b: L },
    ]);
    expectClosed(d);
    const [extremum] = d.keyPoints.filter((k) => k.kind === "extremum");
    expect(extremum.x).toBeCloseTo(L / Math.sqrt(3), 9);
    expect(extremum.left.M).toBeCloseTo((q * L ** 2) / (9 * Math.sqrt(3)), 9);
  });

  it("columna con carga axial repartida: N varía lineal, y en tracción si la carga tira hacia arriba", () => {
    // Columna colgada del nudo de arriba (empotrado), libre abajo, con su propio peso p hacia −Z.
    const p = 3;
    const d = solveBeam(
      { a: free, b: fixed },
      [{ kind: "distributed", direction: "globalZ", q1: -p, q2: -p, a: 0, b: 4 }],
      { id: "a", x: 0, z: 0 },
      { id: "b", x: 0, z: 4 },
    );
    expectClosed(d);
    expect(valueAt(d, 0, "N")).toBeCloseTo(0, 9);
    expect(valueAt(d, 4, "N")).toBeCloseTo(p * 4, 9);
    expect(valueAt(d, 2, "N")).toBeCloseTo(p * 2, 9);
  });
});

describe("memberDiagram — propiedades", () => {
  it("dM/dx = V en todo punto", () => {
    const d = solveBeam({ a: fixed, b: roller }, [
      { kind: "distributed", direction: "perpendicular", q1: -4, q2: -9, a: 1, b: 5 },
      { kind: "point", direction: "globalZ", value: -7, a: 3.3 },
    ]);
    for (let i = 1; i < d.points.length; i++) {
      const [p, q] = [d.points[i - 1], d.points[i]];
      if (q.x - p.x < 1e-6) continue;
      const slope = (q.M - p.M) / (q.x - p.x);
      // La pendiente de la cuerda cae entre los V de los extremos (V es monótono por tramo acá).
      expect(slope).toBeGreaterThanOrEqual(Math.min(p.V, q.V) - 1e-6);
      expect(slope).toBeLessThanOrEqual(Math.max(p.V, q.V) + 1e-6);
    }
  });

  it("los extremos en convención de viga coinciden con el diagrama", () => {
    const loads: MemberLoad[] = [{ kind: "point", direction: "perpendicular", value: 5, a: 2 }];
    const a = { id: "a", x: 0, z: 0 };
    const b = { id: "b", x: L, z: 0 };
    const axis = memberAxis(a, b);
    const system = new System(3);
    system.addNode({ id: "a", restrained: fixed });
    system.addNode({ id: "b", restrained: pin });
    const fem = sumFixedEndForces(loads.map((l) => loadFixedEndForces(l, axis)));
    system.addElement(new FrameElement2D("e", a, b, A, E, I, fem));
    const forces = system.solve().internalForces.get("e") as FrameInternalForce;
    const d = memberDiagram(forces, loads, axis);
    const ends = beamConventionEnds(forces);
    expect(d.points[0]).toMatchObject({ N: ends.from.N, V: ends.from.V, M: ends.from.M });
    const last = d.points[d.points.length - 1];
    expect(last.V).toBeCloseTo(ends.to.V, 9);
    expect(last.M).toBeCloseTo(ends.to.M, 9);
  });
});

describe("memberDiagram — cierre en un pórtico con cargas mezcladas", () => {
  /**
   * Pórtico a dos aguas: dos columnas, dos vigas inclinadas, todas las clases
   * de carga y de dirección. No hay tabla para esto: lo que se comprueba es
   * que en cada barra el diagrama llegue a lo que dio el motor en «hacia».
   */
  it("cierra en las cuatro barras", () => {
    const p = {
      a: { id: "a", x: 0, z: 0 },
      b: { id: "b", x: 0, z: 4 },
      c: { id: "c", x: 5, z: 6 },
      d: { id: "d", x: 10, z: 4 },
      e: { id: "e", x: 10, z: 0 },
    };
    const bars: { id: string; from: Point; to: Point; loads: MemberLoad[] }[] = [
      {
        id: "e1",
        from: p.a,
        to: p.b,
        loads: [
          { kind: "distributed", direction: "globalX", q1: 2, q2: 5, a: 0, b: 4 },
          { kind: "moment", value: 3, a: 1 },
        ],
      },
      {
        id: "e2",
        from: p.b,
        to: p.c,
        loads: [
          { kind: "distributed", direction: "globalZ", q1: -6, q2: -6, a: 0, b: memberAxis(p.b, p.c).length, projected: true },
          { kind: "point", direction: "perpendicular", value: -4, a: 2 },
        ],
      },
      {
        id: "e3",
        from: p.c,
        to: p.d,
        loads: [
          { kind: "distributed", direction: "axial", q1: 1, q2: 1, a: 0.5, b: 3 },
          { kind: "distributed", direction: "globalZ", q1: -2, q2: -8, a: 1, b: 4.5 },
        ],
      },
      { id: "e4", from: p.e, to: p.d, loads: [{ kind: "point", direction: "globalX", value: -5, a: 3 }] },
    ];

    const system = new System(3);
    system.addNode({ id: "a", restrained: fixed });
    system.addNode({ id: "b", restrained: free });
    system.addNode({ id: "c", restrained: free, force: [1, -2, 0] });
    system.addNode({ id: "d", restrained: free });
    system.addNode({ id: "e", restrained: pin });
    for (const bar of bars) {
      const axis = memberAxis(bar.from, bar.to);
      const fem = sumFixedEndForces(bar.loads.map((l) => loadFixedEndForces(l, axis)));
      system.addElement(new FrameElement2D(bar.id, bar.from, bar.to, A, E, I, fem));
    }
    const solved = system.solve();

    for (const bar of bars) {
      const forces = solved.internalForces.get(bar.id) as FrameInternalForce;
      const d = memberDiagram(forces, bar.loads, memberAxis(bar.from, bar.to));
      expectClosed(d);
    }
  });
});
