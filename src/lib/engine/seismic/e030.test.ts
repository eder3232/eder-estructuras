import { describe, expect, it } from "vitest";
import {
  MIN_C_OVER_R,
  amplificationFactor,
  heightExponent,
  inelasticFactor,
  periodFromHeight,
  rayleighPeriod,
  staticAmplificationFactor,
  staticSeismicForces,
} from "./e030";

/**
 * Los valores esperados se sacan a mano de la E.030 2026 (artículos 18, 34,
 * 35, 36 y 50), leída en el PDF oficial. Ver `docs/frame2d-seismic-v1.md`.
 */
describe("E.030 — factor de amplificación C (Tabla N° 6)", () => {
  it("recorre los cuatro renglones", () => {
    // T_P = 0.6, T_L = 2.0 (un S₂ sin Vs30).
    expect(amplificationFactor(0.05, 0.6, 2)).toEqual({ C: 1 + 7.5 * (0.05 / 0.6), branch: "short" });
    expect(amplificationFactor(0.12, 0.6, 2)).toEqual({ C: 2.5, branch: "plateau" });
    expect(amplificationFactor(0.6, 0.6, 2)).toEqual({ C: 2.5, branch: "plateau" });
    expect(amplificationFactor(1, 0.6, 2).C).toBeCloseTo(1.5, 12);
    expect(amplificationFactor(1, 0.6, 2).branch).toBe("descending");
    expect(amplificationFactor(3, 0.6, 2).C).toBeCloseTo((2.5 * 0.6 * 2) / 9, 12);
    expect(amplificationFactor(3, 0.6, 2).branch).toBe("long");
  });

  it("el tramo corto arranca en 1 y empalma con 2.5 en 0.2·T_P", () => {
    expect(amplificationFactor(0, 0.6, 2).C).toBe(1);
    expect(amplificationFactor(0.12 - 1e-12, 0.6, 2).C).toBeCloseTo(2.5, 9);
  });

  it("para el cortante estático, C = 2.5 en todo 0 ≤ T ≤ T_P (18.3): el tramo corto no aplica", () => {
    expect(staticAmplificationFactor(0.05, 0.6, 2)).toEqual({ C: 2.5, branch: "plateau" });
    expect(staticAmplificationFactor(0, 0.6, 2)).toEqual({ C: 2.5, branch: "plateau" });
    expect(staticAmplificationFactor(1, 0.6, 2).C).toBeCloseTo(1.5, 12);
  });

  it("rechaza períodos del suelo incoherentes", () => {
    expect(() => amplificationFactor(0.5, 0, 2)).toThrow(/T_P < T_L/);
    expect(() => amplificationFactor(0.5, 2, 2)).toThrow(/T_P < T_L/);
    expect(() => amplificationFactor(-1, 0.6, 2)).toThrow(/período/);
  });
});

describe("E.030 — período y exponente k", () => {
  it("T = h_n / C_T (36.1)", () => {
    expect(periodFromHeight(9, 35)).toBeCloseTo(9 / 35, 12);
    expect(() => periodFromHeight(0, 35)).toThrow();
  });

  it("k = 1 hasta 0.5 s; después 0.75 + 0.5T, con techo 2 (35.2)", () => {
    expect(heightExponent(0.2)).toBe(1);
    expect(heightExponent(0.5)).toBe(1);
    expect(heightExponent(1)).toBeCloseTo(1.25, 12);
    expect(heightExponent(2.5)).toBe(2);
    expect(heightExponent(4)).toBe(2);
  });

  it("Rayleigh (36.2) con un solo nivel es 2π·√(m/k)", () => {
    const mass = 10;
    const stiffness = 1000;
    const force = 5;
    const T = rayleighPeriod([{ weight: mass * 9.81, force, displacement: force / stiffness }], 9.81);
    expect(T).toBeCloseTo(2 * Math.PI * Math.sqrt(mass / stiffness), 12);
  });

  it("0.75R regular, 0.85R irregular (50)", () => {
    expect(inelasticFactor(8, true)).toBe(6);
    expect(inelasticFactor(8, false)).toBeCloseTo(6.8, 12);
  });
});

describe("E.030 — cortante basal y distribución en altura (34 y 35)", () => {
  // Tres pisos de 3 m, pórticos de concreto (C_T = 35): T = 9/35 = 0.257 s ≤ T_P.
  const levels = [
    { height: 3, weight: 300 },
    { height: 6, weight: 300 },
    { height: 9, weight: 200 },
  ];

  it("V = ZUCS/R·P y Fᵢ = αᵢ·V, hecho a mano", () => {
    const result = staticSeismicForces({ Z: 0.45, U: 1, S: 1, R: 8, C: 2.5, T: 9 / 35, levels });

    expect(result.k).toBe(1);
    expect(result.weight).toBe(800);
    // 0.45 · 1 · 2.5 · 1 / 8 · 800
    expect(result.baseShear).toBeCloseTo(112.5, 10);
    expect(result.driftBaseShear).toBeCloseTo(112.5, 10);
    expect(result.minimumGoverns).toBe(false);
    // Σ Pᵢhᵢ = 900 + 1800 + 1800 = 4500
    expect(result.levels.map((l) => l.alpha)).toEqual([0.2, 0.4, 0.4].map((v) => expect.closeTo(v, 12)));
    expect(result.levels.map((l) => l.force)).toEqual([22.5, 45, 45].map((v) => expect.closeTo(v, 10)));
    expect(result.levels.reduce((sum, l) => sum + l.force, 0)).toBeCloseTo(result.baseShear, 10);
  });

  it("con T > 0.5 s, k > 1 carga más los niveles altos", () => {
    const result = staticSeismicForces({ Z: 0.45, U: 1, S: 1, R: 8, C: 2.5, T: 1, levels });
    const total = 300 * 3 ** 1.25 + 300 * 6 ** 1.25 + 200 * 9 ** 1.25;
    expect(result.k).toBeCloseTo(1.25, 12);
    expect(result.levels[2].alpha).toBeCloseTo((200 * 9 ** 1.25) / total, 12);
    expect(result.levels[2].alpha).toBeGreaterThan(0.4);
  });

  it("si C/R < 0.11 manda el mínimo para diseño, pero no para las derivas (34.2 y 50.3)", () => {
    const result = staticSeismicForces({ Z: 0.45, U: 1, S: 1, R: 8, C: 0.5, T: 2, levels });

    expect(result.cOverR).toBeCloseTo(0.0625, 12);
    expect(result.minimumGoverns).toBe(true);
    expect(result.baseShear).toBeCloseTo(0.45 * MIN_C_OVER_R * 800, 10);
    expect(result.driftBaseShear).toBeCloseTo(0.45 * 0.0625 * 800, 10);
    result.levels.forEach((level) => {
      expect(level.driftForce / level.force).toBeCloseTo(0.0625 / MIN_C_OVER_R, 12);
    });
  });

  it("rechaza datos que no tienen sentido", () => {
    const base = { Z: 0.45, U: 1, S: 1, R: 8, C: 2.5, T: 0.3, levels };
    expect(() => staticSeismicForces({ ...base, R: 0 })).toThrow(/R tiene que ser/);
    expect(() => staticSeismicForces({ ...base, levels: [] })).toThrow(/al menos un nivel/);
    expect(() => staticSeismicForces({ ...base, levels: [{ height: 0, weight: 1 }] })).toThrow(/altura del nivel 1/);
    expect(() => staticSeismicForces({ ...base, levels: [{ height: 3, weight: -1 }] })).toThrow(/peso del nivel 1/);
    expect(() => staticSeismicForces({ ...base, levels: [{ height: 3, weight: 0 }] })).toThrow(/peso total/);
  });
});
