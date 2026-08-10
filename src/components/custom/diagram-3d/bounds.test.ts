import { describe, expect, it } from "vitest";
import { computeBounds, computeUnitSize } from "./bounds";

describe("computeBounds", () => {
  it("devuelve una caja utilizable sin puntos", () => {
    const bounds = computeBounds([]);
    expect(bounds.radius).toBeGreaterThan(0);
    expect(bounds.extent).toBeGreaterThan(0);
  });

  it("centra la caja en el punto medio de los extremos", () => {
    const bounds = computeBounds([
      [0, 0, 0],
      [4, 2, 6],
    ]);
    expect(bounds.center).toEqual([2, 1, 3]);
    expect(bounds.extent).toBe(6);
  });

  it("no colapsa el radio con figuras planas", () => {
    // Todos los nudos en el plano z = 0: la altura es cero, pero la cámara
    // igual necesita una distancia distinta de cero.
    const bounds = computeBounds([
      [0, 0, 0],
      [3, 4, 0],
    ]);
    expect(bounds.radius).toBeGreaterThan(0);
    expect(computeUnitSize(bounds)).toBeGreaterThan(0);
  });
});
