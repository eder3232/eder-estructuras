import { describe, expect, it } from "vitest";
import { DRIFT_LIMITS, storyDrifts } from "./drift";

describe("storyDrifts (E.030, 50 y 51)", () => {
  it("multiplica por el factor, resta el nivel de abajo y divide por el entrepiso", () => {
    const [first, second] = storyDrifts({
      heights: [3.5, 6.5],
      displacements: [0.002, 0.005],
      factor: 6,
      limit: DRIFT_LIMITS.concrete,
    });

    expect(first.storyHeight).toBe(3.5);
    expect(first.inelastic).toBeCloseTo(0.012, 12);
    expect(first.drift).toBeCloseTo(0.012, 12);
    expect(first.ratio).toBeCloseTo(0.012 / 3.5, 12);
    expect(first.ok).toBe(true);

    expect(second.storyHeight).toBe(3);
    expect(second.inelastic).toBeCloseTo(0.03, 12);
    expect(second.drift).toBeCloseTo(0.018, 12);
    expect(second.ratio).toBeCloseTo(0.006, 12);
    expect(second.ok).toBe(true);
  });

  it("marca el entrepiso que pasa el límite, con el sismo en cualquier sentido", () => {
    const drifts = storyDrifts({ heights: [3, 6], displacements: [-0.001, -0.0055], factor: 6, limit: 0.007 });
    expect(drifts[0].ok).toBe(true);
    expect(drifts[1].ratio).toBeCloseTo(0.009, 12);
    expect(drifts[1].ok).toBe(false);
  });

  it("los límites de la Tabla N° 14", () => {
    expect(DRIFT_LIMITS).toEqual({
      concrete: 0.007,
      steel: 0.01,
      masonry: 0.005,
      wood: 0.01,
      limitedDuctilityWalls: 0.004,
    });
  });

  it("rechaza niveles desordenados o sin desplazamiento", () => {
    expect(() => storyDrifts({ heights: [6, 3], displacements: [0, 0], factor: 6, limit: 0.007 })).toThrow(/crecientes/);
    expect(() => storyDrifts({ heights: [3], displacements: [], factor: 6, limit: 0.007 })).toThrow(/por nivel/);
  });
});
