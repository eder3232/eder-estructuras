import { describe, expect, it } from "vitest";

import { computeUnitSize } from "./unit-scale";
import { computeViewBox, projectPoint, type SvgPoint } from "./viewbox";

/**
 * Lo que hace falta afuera del último nudo para que entre la etiqueta más
 * larga: flecha (2.2 unidades) + separación (0.55) + un número de siete
 * caracteres en monoespaciada (7 × 0.6 = 4.2).
 */
const LABEL_ALLOWANCE = 6.95;

const shapes: Record<string, SvgPoint[]> = {
  "armadura semilla (más alta que ancha)": [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 0, y: -4 },
    { x: 3, y: -4 },
  ],
  "pórtico (más ancho que alto)": [
    { x: 0, y: 0 },
    { x: 0, y: -3 },
    { x: 5, y: -3 },
    { x: 5, y: 0 },
  ],
  "una sola barra horizontal": [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
};

describe("computeViewBox", () => {
  it.each(Object.entries(shapes))("deja lugar para la etiqueta más larga: %s", (_name, points) => {
    const box = computeViewBox(points);
    const unitSize = computeUnitSize(box);
    const padX = Math.min(...points.map((p) => p.x)) - box.minX;
    const padY = Math.min(...points.map((p) => p.y)) - box.minY;

    // La desigualdad se muerde la cola —el margen entra en el `max` que define
    // la unidad, así que agrandarlo agranda el texto que tiene que entrar—, y
    // por eso conviene fijarla acá y no dejarla en un comentario: si alguien
    // baja el `paddingRatio` para que la figura se vea más grande, el número de
    // una reacción horizontal se corta contra el borde del lienzo. Ya pasó.
    expect(padX).toBeGreaterThanOrEqual(LABEL_ALLOWANCE * unitSize);
    expect(padY).toBeGreaterThanOrEqual(LABEL_ALLOWANCE * unitSize);
  });

  it("no colapsa cuando todos los nudos están alineados", () => {
    const box = computeViewBox([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);

    expect(box.height).toBeGreaterThan(0);
    expect(box.width).toBeGreaterThan(4);
  });
});

describe("projectPoint", () => {
  it("da vuelta el eje vertical: z crece hacia arriba y el y de SVG hacia abajo", () => {
    expect(projectPoint({ x: 3, z: 4 })).toEqual({ x: 3, y: -4 });
  });
});
