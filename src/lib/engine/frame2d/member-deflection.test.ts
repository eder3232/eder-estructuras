import { describe, expect, it } from "vitest";
import { System } from "../system";
import { FrameElement2D } from "./frame-element-2d";
import { memberDeflection, type MemberDeflection } from "./member-deflection";
import { loadFixedEndForces, memberAxis, sumFixedEndForces, type MemberLoad } from "./member-loads";

/**
 * Las flechas esperadas son las de las tablas de los libros. La integral es
 * exacta (ver `member-deflection.ts`), así que se pide coincidencia a 9 cifras
 * relativas: con trapecios, la primera versión erraba en la quinta.
 */

const E = 200;
const I = 3;
const A = 1;
const L = 6;
const EI = E * I;

type Restraint = [boolean, boolean, boolean];

function deflect(restraints: { a: Restraint; b: Restraint }, loads: MemberLoad[], nodeForceB?: [number, number, number]) {
  const a = { id: "a", x: 0, z: 0 };
  const b = { id: "b", x: L, z: 0 };
  const axis = memberAxis(a, b);
  const fem = sumFixedEndForces(loads.map((l) => loadFixedEndForces(l, axis)));
  const system = new System(3);
  system.addNode({ id: "a", restrained: restraints.a });
  system.addNode({ id: "b", restrained: restraints.b, force: nodeForceB });
  system.addElement(new FrameElement2D("e", a, b, A, E, I, fem));
  const { displacements } = system.solve();
  // Barra horizontal: ejes locales = globales.
  const localEnds = [...displacements.get("a")!, ...displacements.get("b")!];
  return memberDeflection({ axis, localEnds, fixedEndForces: fem, loads, ea: E * A, ei: EI });
}

function vAt(d: MemberDeflection, x: number) {
  return d.points.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best)).v;
}

const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThan(Math.abs(expected) * 1e-9 + 1e-15);

const pin: Restraint = [true, true, false];
const roller: Restraint = [false, true, false];
const fixed: Restraint = [true, true, true];
const free: Restraint = [false, false, false];
const q = 10;
const uniform: MemberLoad = { kind: "distributed", direction: "globalZ", q1: -q, q2: -q, a: 0, b: L };

describe("memberDeflection — flechas de libro", () => {
  it("simplemente apoyada con carga uniforme: 5qL⁴/384EI al centro", () => {
    const d = deflect({ a: pin, b: roller }, [uniform]);
    close(vAt(d, L / 2), (-5 * q * L ** 4) / (384 * EI));
  });

  it("biempotrada con carga uniforme: qL⁴/384EI al centro, aunque los nudos no se muevan ni giren", () => {
    const d = deflect({ a: fixed, b: fixed }, [uniform]);
    close(vAt(d, L / 2), (-q * L ** 4) / (384 * EI));
    // La tangente en el empotramiento es horizontal: cerca del apoyo la flecha
    // crece como x², así que al doble de distancia hay el cuádruple de flecha
    // (con pendiente, sería el doble). Lo que sobra es el término cúbico.
    const [, near, twice] = d.points;
    expect(twice.x).toBeCloseTo(2 * near.x, 12);
    expect(twice.v / near.v).toBeGreaterThan(3.6);
    expect(twice.v / near.v).toBeLessThan(4);
  });

  it("ménsula con carga uniforme: qL⁴/8EI en la punta y 17qL⁴/384EI a la mitad", () => {
    const d = deflect({ a: fixed, b: free }, [uniform]);
    close(vAt(d, L), (-q * L ** 4) / (8 * EI));
    close(vAt(d, L / 2), (-17 * q * L ** 4) / (384 * EI));
  });

  it("ménsula con carga en la punta como carga nodal: la cúbica de Hermite sola, PL³/3EI", () => {
    const P = 4;
    const d = deflect({ a: fixed, b: free }, [], [0, -P, 0]);
    close(vAt(d, L), (-P * L ** 3) / (3 * EI));
    // Sin carga en la barra, la flecha a la mitad es la de Hermite: 5PL³/48EI.
    close(vAt(d, L / 2), (-5 * P * L ** 3) / (48 * EI));
  });

  it("simplemente apoyada con puntual al centro: PL³/48EI", () => {
    const P = 12;
    const d = deflect({ a: pin, b: roller }, [{ kind: "point", direction: "globalZ", value: -P, a: L / 2 }]);
    close(vAt(d, L / 2), (-P * L ** 3) / (48 * EI));
  });
});

describe("memberDeflection — la parte particular cierra", () => {
  it("con cualquier carga, la biempotrada no se mueve ni gira en «hacia»", () => {
    const loads: MemberLoad[] = [
      { kind: "distributed", direction: "perpendicular", q1: 3, q2: -8, a: 0.5, b: 4.5 },
      { kind: "distributed", direction: "axial", q1: 2, q2: 2, a: 1, b: 5 },
      { kind: "point", direction: "globalZ", value: -6, a: 2 },
      { kind: "moment", value: 5, a: 3.5 },
    ];
    const d = deflect({ a: fixed, b: fixed }, loads);
    const scale = Math.max(...d.points.map((p) => Math.abs(p.v)));
    expect(Math.abs(d.closure.v)).toBeLessThan(scale * 1e-9);
    expect(Math.abs(d.closure.slope) * L).toBeLessThan(scale * 1e-9);
    const uScale = Math.max(...d.points.map((p) => Math.abs(p.u)), 1e-30);
    expect(Math.abs(d.closure.u)).toBeLessThan(uScale * 1e-9 + 1e-15);
  });
});
