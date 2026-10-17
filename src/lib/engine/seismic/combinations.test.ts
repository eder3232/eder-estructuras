import { describe, expect, it } from "vitest";
import { System } from "../system";
import { FrameElement2D, type FrameInternalForce } from "../frame2d/frame-element-2d";
import { memberDiagram } from "../frame2d/member-diagrams";
import { loadFixedEndForces, memberAxis, sumFixedEndForces, type MemberLoad } from "../frame2d/member-loads";
import {
  E060_COMBINATIONS,
  combineEndForces,
  combineVectors,
  combinedMemberDiagram,
  diagramEnvelope,
  scaleMemberLoad,
} from "./combinations";

describe("combinaciones E.060 (9.2)", () => {
  it("son las cinco, con el ± expandido", () => {
    expect(E060_COMBINATIONS.map((c) => c.factors)).toEqual([
      { CM: 1.4, CV: 1.7 },
      { CM: 1.25, CV: 1.25, CS: 1 },
      { CM: 1.25, CV: 1.25, CS: -1 },
      { CM: 0.9, CS: 1 },
      { CM: 0.9, CS: -1 },
    ]);
  });

  it("combineVectors suma por factor e ignora los casos que no figuran", () => {
    expect(combineVectors({ CM: [1, 2], CV: [10, 20], CS: [100, 200] }, { CM: 1.4, CV: 1.7 })).toEqual([
      1.4 + 17,
      2.8 + 34,
    ]);
    expect(combineVectors({ CM: [1, -1] }, { CM: 0 })).toEqual([0, 0]);
    expect(Object.is(combineVectors({ CM: [0] }, { CM: -1 })[0], -0)).toBe(false);
    expect(() => combineVectors({ CM: [1], CV: [1, 2] }, {})).toThrow(/largo/);
  });

  it("scaleMemberLoad escala la intensidad y deja el resto", () => {
    expect(scaleMemberLoad({ kind: "point", direction: "globalZ", value: -10, a: 2 }, 1.7)).toEqual({
      kind: "point",
      direction: "globalZ",
      value: -17,
      a: 2,
    });
    expect(
      scaleMemberLoad({ kind: "distributed", direction: "perpendicular", q1: 2, q2: 4, a: 0, b: 3, projected: false }, -1),
    ).toEqual({ kind: "distributed", direction: "perpendicular", q1: -2, q2: -4, a: 0, b: 3, projected: false });
  });
});

/**
 * La prueba de la superposición: un portal con carga muerta repartida en la
 * viga, viva puntual y sismo en el nudo. Resolver **cada caso por separado y
 * combinar** tiene que dar lo mismo que resolver **una vez con las cargas ya
 * combinadas**.
 */
const E = 2.2e7;
const COLUMN = { area: 0.09, inertia: 0.000675 };
const BEAM = { area: 0.15, inertia: 0.003125 };
const points = {
  v1: { id: "v1", x: 0, z: 0 },
  v2: { id: "v2", x: 0, z: 3 },
  v3: { id: "v3", x: 6, z: 3 },
  v4: { id: "v4", x: 6, z: 0 },
};
const beamAxis = memberAxis(points.v2, points.v3);

const CASES: Record<string, { beamLoads: MemberLoad[]; lateral: number }> = {
  CM: { beamLoads: [{ kind: "distributed", direction: "globalZ", q1: -20, q2: -20, a: 0, b: 6 }], lateral: 0 },
  CV: { beamLoads: [{ kind: "point", direction: "globalZ", value: -15, a: 2 }], lateral: 0 },
  CS: { beamLoads: [], lateral: 12 },
};

function solvePortal(beamLoads: MemberLoad[], lateral: number) {
  const system = new System(3);
  system.addNode({ id: "v1", restrained: [true, true, true] });
  system.addNode({ id: "v2", restrained: [false, false, false], force: [lateral, 0, 0] });
  system.addNode({ id: "v3", restrained: [false, false, false] });
  system.addNode({ id: "v4", restrained: [true, true, true] });
  const fem = sumFixedEndForces(beamLoads.map((load) => loadFixedEndForces(load, beamAxis)));
  system.addElement(new FrameElement2D("c1", points.v1, points.v2, COLUMN.area, E, COLUMN.inertia));
  system.addElement(new FrameElement2D("v", points.v2, points.v3, BEAM.area, E, BEAM.inertia, fem));
  system.addElement(new FrameElement2D("c2", points.v3, points.v4, COLUMN.area, E, COLUMN.inertia));
  return system.solve();
}

const byCase = Object.fromEntries(
  Object.entries(CASES).map(([id, c]) => {
    const result = solvePortal(c.beamLoads, c.lateral);
    return [id, { result, beam: { endForces: result.internalForces.get("v") as FrameInternalForce, loads: c.beamLoads } }];
  }),
);

describe("superposición: combinar casos = resolver con las cargas combinadas", () => {
  for (const combination of E060_COMBINATIONS) {
    it(combination.name, () => {
      const { factors } = combination;
      const direct = solvePortal(
        Object.entries(CASES).flatMap(([id, c]) => c.beamLoads.map((l) => scaleMemberLoad(l, factors[id] ?? 0))),
        Object.entries(CASES).reduce((sum, [id, c]) => sum + (factors[id] ?? 0) * c.lateral, 0),
      );

      // Reacciones y desplazamientos.
      for (const node of ["v1", "v2", "v3", "v4"]) {
        const reactions = combineVectors(
          Object.fromEntries(Object.entries(byCase).map(([id, c]) => [id, c.result.reactions.get(node)!])),
          factors,
        );
        reactions.forEach((value, i) => expect(value).toBeCloseTo(direct.reactions.get(node)![i], 8));
      }

      // Fuerzas de extremo y el diagrama de la viga, en todo x.
      const endForces = combineEndForces(
        Object.fromEntries(Object.entries(byCase).map(([id, c]) => [id, c.beam.endForces])),
        factors,
      );
      const directForces = direct.internalForces.get("v") as FrameInternalForce;
      for (const end of ["from", "to"] as const) {
        for (const key of ["axial", "shear", "moment"] as const) {
          expect(endForces[end][key]).toBeCloseTo(directForces[end][key], 8);
        }
      }

      const combined = combinedMemberDiagram(
        Object.fromEntries(Object.entries(byCase).map(([id, c]) => [id, c.beam])),
        factors,
        beamAxis,
      );
      const reference = memberDiagram(
        directForces,
        Object.entries(CASES).flatMap(([id, c]) => c.beamLoads.map((l) => scaleMemberLoad(l, factors[id] ?? 0))),
        beamAxis,
      );
      for (let x = 0; x <= 6; x += 0.25) {
        for (const side of ["left", "right"] as const) {
          const a = combined.at(x, side);
          const b = reference.at(x, side);
          expect(a.N).toBeCloseTo(b.N, 8);
          expect(a.V).toBeCloseTo(b.V, 8);
          expect(a.M).toBeCloseTo(b.M, 8);
        }
      }
      expect(combined.closure.M).toBeCloseTo(0, 8);
    });
  }
});

describe("diagramEnvelope", () => {
  const diagrams = E060_COMBINATIONS.map((c) => ({
    id: c.id,
    diagram: combinedMemberDiagram(
      Object.fromEntries(Object.entries(byCase).map(([id, cs]) => [id, cs.beam])),
      c.factors,
      beamAxis,
    ),
  }));
  const envelope = diagramEnvelope(diagrams);

  it("en cada estación, el máximo y el mínimo de todas las combinaciones, y quién los da", () => {
    for (const point of envelope) {
      const side = point === envelope.find((p) => p.x === point.x) ? "left" : "right";
      for (const effect of ["N", "V", "M"] as const) {
        const values = diagrams.map((d) => d.diagram.at(point.x, side)[effect]);
        expect(point.max[effect]).toBeCloseTo(Math.max(...values), 9);
        expect(point.min[effect]).toBeCloseTo(Math.min(...values), 9);
        const maxBy = diagrams.find((d) => d.id === point.maxBy[effect])!;
        expect(maxBy.diagram.at(point.x, side)[effect]).toBeCloseTo(point.max[effect], 9);
      }
    }
  });

  it("incluye los máximos de M de cada combinación, y dos puntos donde una carga puntual hace saltar V", () => {
    for (const { diagram } of diagrams) {
      for (const key of diagram.keyPoints.filter((k) => k.kind === "extremum")) {
        expect(envelope.some((p) => Math.abs(p.x - key.x) < 1e-12)).toBe(true);
      }
    }
    // La viva puntual en x = 2: V salta en las combinaciones que la llevan.
    const atLoad = envelope.filter((p) => p.x === 2);
    expect(atLoad).toHaveLength(2);
    expect(atLoad[0].max.V).not.toBeCloseTo(atLoad[1].max.V, 3);
  });

  it("con el sismo en los dos sentidos, el M de los extremos de la viga cambia de signo entre combinaciones", () => {
    const start = envelope[0];
    expect(start.x).toBe(0);
    expect(start.max.M).toBeGreaterThan(start.min.M);
    expect(["u2", "u3", "u4", "u5"]).toContain(start.maxBy.M);
  });
});
