// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Provider } from "jotai";

import { ForceArrow } from "./force-arrow";

/**
 * D6: la etiqueta de una flecha se apoyaba sobre el eje de su propia flecha.
 * Centrada un poco más allá de la punta, media etiqueta quedaba *detrás* del
 * punto de anclaje — o sea encima de la cabeza de la flecha, con la punta
 * clavada entre dos dígitos— y, en las verticales, encima de la barra que sale
 * del nudo.
 *
 * Se ejercita sobre el DOM y no sobre una función pura a propósito: lo que hay
 * que fijar es la relación entre tres cosas que solo existen juntas en el
 * render —dónde termina la flecha, dónde arranca el texto y hacia dónde crece—,
 * y el `textAnchor` es justamente la mitad de la que no se ve en las
 * coordenadas.
 */

afterEach(cleanup);

const UNIT = 1;

/** `ForceArrow` rinde nodos SVG: montarlo suelto en un <div> no es válido. */
function renderArrow(props: Parameters<typeof ForceArrow>[0]) {
  const { container } = render(
    <Provider>
      <svg>
        <ForceArrow {...props} />
      </svg>
    </Provider>,
  );
  const text = container.querySelector("text");
  const line = container.querySelector("line");
  if (!text || !line) throw new Error("la flecha no rindió su línea y su etiqueta");

  return {
    label: {
      x: Number(text.getAttribute("x")),
      y: Number(text.getAttribute("y")),
      anchor: text.getAttribute("text-anchor"),
    },
    // La punta de la flecha: el extremo libre de la línea.
    head: { x: Number(line.getAttribute("x2")), y: Number(line.getAttribute("y2")) },
    tail: { x: Number(line.getAttribute("x1")), y: Number(line.getAttribute("y1")) },
    container,
  };
}

describe("ForceArrow", () => {
  it("no vuelve sobre su propia punta: la etiqueta arranca después y crece hacia afuera", () => {
    const derecha = renderArrow({ x: 0, z: 0, axis: "x", value: 4.8, unitSize: UNIT, variant: "force" });

    expect(derecha.label.x).toBeGreaterThan(derecha.head.x);
    // Con `start` el texto crece alejándose de la flecha. Centrado, la mitad
    // del número volvía sobre la cabeza: ese era el bug.
    expect(derecha.label.anchor).toBe("start");
  });

  it("hace lo mismo espejado cuando la fuerza apunta al otro lado", () => {
    const izquierda = renderArrow({ x: 0, z: 0, axis: "x", value: -4.8, unitSize: UNIT, variant: "force" });

    expect(izquierda.label.x).toBeLessThan(izquierda.head.x);
    expect(izquierda.label.anchor).toBe("end");
  });

  it("baja la etiqueta de una flecha horizontal, donde los nombres de barra no llegan", () => {
    const derecha = renderArrow({ x: 0, z: 0, axis: "x", value: 4.8, unitSize: UNIT, variant: "force" });

    // Los nombres de barra del esquema van *arriba* de su barra; el número de
    // una carga horizontal sobre un cordón les quedaba pegado.
    expect(derecha.label.y).toBeGreaterThan(derecha.head.y);
  });

  it("corre al costado la etiqueta de una flecha vertical, que si no cae sobre la barra", () => {
    const abajo = renderArrow({ x: 0, z: 0, axis: "z", value: -6.4, unitSize: UNIT, variant: "force" });

    // La barra que sale del nudo comparte el eje con la flecha: quedarse en
    // `label.x === head.x` es quedarse encima de la barra.
    expect(abajo.label.x).toBeGreaterThan(abajo.head.x);
    expect(abajo.label.anchor).toBe("start");
  });

  it("le pone halo a la etiqueta para que se lea con una barra atrás", () => {
    const { container } = renderArrow({ x: 0, z: 0, axis: "z", value: -6.4, unitSize: UNIT, variant: "force" });
    const className = container.querySelector("text")?.getAttribute("class") ?? "";

    // Correr las etiquetas resuelve los choques previsibles; el halo cubre los
    // que dependen de la geometría que cargue el usuario.
    expect(className).toContain("[paint-order:stroke]");
    expect(className).toContain("stroke-background");
  });

  it("no dibuja nada si la fuerza es cero", () => {
    const { container } = render(
      <Provider>
        <svg>
          <ForceArrow x={0} z={0} axis="x" value={0} unitSize={UNIT} variant="force" />
        </svg>
      </Provider>,
    );

    expect(container.querySelector("text")).toBeNull();
    expect(container.querySelector("line")).toBeNull();
  });
});
