import { describe, expect, it } from "vitest";
import { compositeOver } from "./theme-colors";

/**
 * La conversión de formato la hace el navegador (ver el comentario de
 * `theme-colors.ts`), así que no hay nada propio que probar ahí: el único
 * cálculo de este módulo es componer la transparencia sobre el fondo. Que los
 * colores sigan al tema se verifica mirando la escena en los dos temas.
 */
describe("compositeOver", () => {
  it("deja igual un color opaco", () => {
    expect(compositeOver([0x12, 0x34, 0x56, 255], 0xffffff)).toBe(0x123456);
  });

  it("un color transparente es el fondo", () => {
    expect(compositeOver([255, 255, 255, 0], 0x0a0a0a)).toBe(0x0a0a0a);
  });

  it("el borde de oscuro (blanco al 10%) queda cerca del fondo, no blanco", () => {
    // Es el caso que dejaba la grilla del piso blanca pura.
    const border = compositeOver([255, 255, 255, 26], 0x0a0a0a);
    const channel = (border >> 16) & 0xff;
    expect(channel).toBeGreaterThan(0x0a);
    expect(channel).toBeLessThan(0x30);
  });
});
