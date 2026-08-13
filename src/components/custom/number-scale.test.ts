import { describe, expect, it } from "vitest";

import { formatScaled, scaleExponent, scaleLabel } from "./number-scale";

describe("scaleExponent", () => {
  it("saca afuera la escala de una matriz de rigidez", () => {
    // El caso real: la K de una barra de la armadura semilla.
    expect(scaleExponent([8106.6667, -1920, -6666.6667, 0])).toBe(3);
  });

  it("saca afuera la escala de un vector de desplazamientos, que es lo contrario", () => {
    // `0.0025` con 4 decimales es casi todo ceros a la izquierda.
    expect(scaleExponent([0.0025, -0.0002, 0.0024])).toBe(-3);
  });

  it("no toca los números que ya se leen de corrido", () => {
    expect(scaleExponent([4.8, -6.4, 0])).toBe(0);
    expect(scaleExponent([999.9, 0.02])).toBe(0);
  });

  it("usa múltiplos de 3, para que el factor sea una unidad con nombre", () => {
    expect(scaleExponent([2e7])).toBe(6);
    expect(scaleExponent([1.5e-7])).toBe(-9);
  });

  it("no inventa factor para una matriz de ceros", () => {
    expect(scaleExponent([0, 0, 0])).toBe(0);
    expect(scaleExponent([])).toBe(0);
  });

  it("ignora los no finitos en vez de contagiarse", () => {
    expect(scaleExponent([NaN, 5, Infinity])).toBe(0);
  });
});

describe("scaleLabel", () => {
  it("escribe el factor con exponente en superíndice", () => {
    expect(scaleLabel(3)).toBe("×10³");
    expect(scaleLabel(-3)).toBe("×10⁻³");
    expect(scaleLabel(0)).toBeNull();
  });
});

describe("formatScaled", () => {
  it("divide por el factor de la matriz", () => {
    expect(formatScaled(6666.6667, 4, 3)).toBe("6.6667");
    expect(formatScaled(0.0025, 4, -3)).toBe("2.5000");
  });

  it("sin factor, es un `toFixed` común", () => {
    expect(formatScaled(4.8, 2, 0)).toBe("4.80");
  });

  it("no muestra «-0.0000»", () => {
    // Sale del cero negativo del cálculo, y en una matriz llena de ceros el
    // signo suelto se lee como un valor distinto de sus vecinos.
    expect(formatScaled(-1e-12, 4, 0)).toBe("0.0000");
    expect(formatScaled(-0, 2, 0)).toBe("0.00");
  });
});
