import { describe, expect, it } from "vitest";
import { oklchToHex } from "./theme-colors";

describe("oklchToHex", () => {
  it("convierte los extremos acromáticos", () => {
    expect(oklchToHex("oklch(1 0 0)")).toBe(0xffffff);
    expect(oklchToHex("oklch(0 0 0)")).toBe(0x000000);
  });

  it("mantiene los grises con las tres componentes iguales", () => {
    const hex = oklchToHex("oklch(0.556 0 0)")!;
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    expect(g).toBe(r);
    expect(b).toBe(r);
    // Un gris medio, no un extremo.
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(160);
  });

  it("ubica los tokens con color en el tono correcto", () => {
    // --destructive del tema: rojo (R dominante).
    const destructive = oklchToHex("oklch(0.577 0.245 27.325)")!;
    expect((destructive >> 16) & 0xff).toBeGreaterThan((destructive >> 8) & 0xff);
    expect((destructive >> 16) & 0xff).toBeGreaterThan(destructive & 0xff);

    // --primary del tema: verde (G dominante).
    const primary = oklchToHex("oklch(0.527 0.154 150.069)")!;
    expect((primary >> 8) & 0xff).toBeGreaterThan((primary >> 16) & 0xff);
    expect((primary >> 8) & 0xff).toBeGreaterThan(primary & 0xff);
  });

  it("acepta la luminosidad en porcentaje", () => {
    expect(oklchToHex("oklch(100% 0 0)")).toBe(0xffffff);
  });

  it("devuelve null si no es un oklch()", () => {
    expect(oklchToHex("#ff0000")).toBeNull();
    expect(oklchToHex("")).toBeNull();
  });
});
