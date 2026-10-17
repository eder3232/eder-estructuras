import { describe, expect, it } from "vitest";
import { inv, multiply } from "mathjs";
import { System } from "../system";
import { FrameElement2D } from "../frame2d/frame-element-2d";
import { condense, lateralStiffness } from "./condensation";

describe("condense", () => {
  it("2×2 a mano: K_c = K_aa − K_ab·K_bb⁻¹·K_ba", () => {
    const result = condense(
      [
        [4, -2],
        [-2, 3],
      ],
      [0],
    );
    expect(result.drop).toEqual([1]);
    expect(result.condensed[0][0]).toBeCloseTo(4 - 4 / 3, 12);
    expect(result.correction[0][0]).toBeCloseTo(4 / 3, 12);
  });

  it("sin nada que eliminar devuelve K_aa", () => {
    const k = [
      [2, -1],
      [-1, 2],
    ];
    expect(condense(k, [1, 0]).condensed).toEqual([
      [2, -1],
      [-1, 2],
    ]);
  });

  it("rechaza posiciones repetidas o fuera de la matriz", () => {
    const k = [[1]];
    expect(() => condense(k, [])).toThrow(/al menos un grado/);
    expect(() => condense(k, [1])).toThrow(/posiciones/);
    expect(() => condense([[1, 0], [0, 1]], [0, 0])).toThrow(/posiciones/);
  });
});

/**
 * Pórtico de dos pisos y un vano, con diafragma en cada piso. Columnas
 * empotradas en la base.
 */
const E = 2.2e7;
const COLUMN = { area: 0.3 * 0.3, inertia: (0.3 * 0.3 ** 3) / 12 };
const BEAM = { area: 0.3 * 0.5, inertia: (0.3 * 0.5 ** 3) / 12 };
const H = 3;
const SPAN = 5;

function twoStory({ beam = BEAM, column = COLUMN, forces = [10, 20] } = {}) {
  const p = {
    b1: { id: "b1", x: 0, z: 0 },
    b2: { id: "b2", x: SPAN, z: 0 },
    n1: { id: "n1", x: 0, z: H },
    n2: { id: "n2", x: SPAN, z: H },
    n3: { id: "n3", x: 0, z: 2 * H },
    n4: { id: "n4", x: SPAN, z: 2 * H },
  };
  const system = new System(3);
  system.addNode({ id: "b1", restrained: [true, true, true] });
  system.addNode({ id: "b2", restrained: [true, true, true] });
  system.addNode({ id: "n1", restrained: [false, false, false], force: [forces[0], 0, 0] });
  system.addNode({ id: "n2", restrained: [false, false, false] });
  system.addNode({ id: "n3", restrained: [false, false, false], force: [forces[1], 0, 0] });
  system.addNode({ id: "n4", restrained: [false, false, false] });
  const bar = (id: string, a: keyof typeof p, b: keyof typeof p, s: { area: number; inertia: number }) =>
    system.addElement(new FrameElement2D(id, p[a], p[b], s.area, E, s.inertia));
  bar("c1", "b1", "n1", column);
  bar("c2", "b2", "n2", column);
  bar("c3", "n1", "n3", column);
  bar("c4", "n2", "n4", column);
  bar("v1", "n1", "n2", beam);
  bar("v2", "n3", "n4", beam);
  system.addDiaphragm({ id: "piso 1", nodeIds: ["n1", "n2"], localDof: 0 });
  system.addDiaphragm({ id: "piso 2", nodeIds: ["n3", "n4"], localDof: 0 });
  return system;
}

describe("lateralStiffness", () => {
  it("K_L⁻¹·F da los mismos desplazamientos laterales que el análisis completo", () => {
    const result = twoStory().solve();
    const lateral = lateralStiffness(result.assembly, ["piso 1", "piso 2"]);

    expect(lateral.condensed).toHaveLength(2);
    expect(lateral.kbb).toHaveLength(result.assembly.partition.free.length - 2);
    const delta = multiply(inv(lateral.condensed), [[10], [20]]) as number[][];
    expect(delta[0][0]).toBeCloseTo(result.displacements.get("n1")![0], 12);
    expect(delta[1][0]).toBeCloseTo(result.displacements.get("n3")![0], 12);
  });

  it("es simétrica, y no depende de las cargas", () => {
    const a = lateralStiffness(twoStory().solve().assembly, ["piso 1", "piso 2"]).condensed;
    const b = lateralStiffness(twoStory({ forces: [1, -7] }).solve().assembly, ["piso 1", "piso 2"]).condensed;
    expect(a[0][1]).toBeCloseTo(a[1][0], 6);
    a.forEach((row, i) => row.forEach((value, j) => expect(value).toBeCloseTo(b[i][j], 6)));
  });

  it("con vigas rígidas y columnas que no se acortan tiende al edificio de corte: k·[[2, −1], [−1, 1]]", () => {
    const beam = { area: BEAM.area, inertia: COLUMN.inertia * 1e5 };
    const column = { area: COLUMN.area * 1e4, inertia: COLUMN.inertia };
    const kl = lateralStiffness(twoStory({ beam, column }).solve().assembly, ["piso 1", "piso 2"]).condensed;
    // Cada piso: dos columnas biempotradas, 12EI/h³ cada una.
    const k = (24 * E * COLUMN.inertia) / H ** 3;
    expect(kl[0][0] / k).toBeCloseTo(2, 3);
    expect(kl[0][1] / k).toBeCloseTo(-1, 3);
    expect(kl[1][1] / k).toBeCloseTo(1, 3);
  });

  it("pide los pisos en el orden dado", () => {
    const assembly = twoStory().solve().assembly;
    const up = lateralStiffness(assembly, ["piso 1", "piso 2"]).condensed;
    const down = lateralStiffness(assembly, ["piso 2", "piso 1"]).condensed;
    expect(down[0][0]).toBeCloseTo(up[1][1], 9);
    expect(() => lateralStiffness(assembly, ["piso 3"])).toThrow(/no está/);
  });
});
