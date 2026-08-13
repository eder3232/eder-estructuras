// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";

import { MatrixTable } from "./matrix-table";
import { atomCompactNumbers } from "./number-scale";

/**
 * La notación compacta se ve en la captura, pero lo que la captura no puede
 * decir es si el interruptor la apaga de verdad — y ese interruptor existe por
 * un caso de uso concreto: cotejar contra un ejercicio resuelto a mano.
 */

afterEach(cleanup);

const K = [
  [8106.6667, -1920],
  [-1920, 7560],
];

function renderMatrix(compact: boolean, props: Partial<Parameters<typeof MatrixTable>[0]> = {}) {
  const store = createStore();
  store.set(atomCompactNumbers, compact);
  return render(
    <Provider store={store}>
      <MatrixTable matrix={K} labels={["v3x", "v3z"]} {...props} />
    </Provider>,
  );
}

describe("MatrixTable", () => {
  it("saca la escala afuera y la anuncia una sola vez", () => {
    const { container } = renderMatrix(true);

    expect(container.querySelector("caption")?.textContent).toBe("×10³");
    expect(screen.getByText("8.1067")).toBeDefined();
    // Una sola vez: si el factor se repitiera por celda no habría ganado nada.
    expect(container.querySelectorAll("caption")).toHaveLength(1);
  });

  it("apagada, muestra el número completo y no anuncia factor", () => {
    const { container } = renderMatrix(false);

    expect(container.querySelector("caption")).toBeNull();
    expect(screen.getByText("8106.6667")).toBeDefined();
  });

  it("no inventa factor para una matriz que ya se lee de corrido", () => {
    const { container } = render(
      <Provider>
        <MatrixTable matrix={[[4.8, -6.4]]} colLabels={["a", "b"]} />
      </Provider>,
    );

    expect(container.querySelector("caption")).toBeNull();
    expect(screen.getByText("4.8000")).toBeDefined();
  });

  it("al pasar el mouse por una celda resalta también su simétrica", async () => {
    const user = userEvent.setup();
    const { container } = renderMatrix(true, { symmetricHighlight: true });
    const celdas = () => [...container.querySelectorAll("tbody td")];

    await user.hover(celdas()[1]); // fila 0, columna 1

    // `k_ij = k_ji`: la propiedad que siempre se enuncia y nunca se muestra.
    const resaltadas = celdas()
      .map((td, i) => (td.className.includes("text-primary-foreground") ? i : -1))
      .filter((i) => i >= 0);
    expect(resaltadas).toEqual([1, 2]); // (0,1) y (1,0)
  });

  it("sin la prop no resalta nada, porque en una matriz no cuadrada la espejada no existe", async () => {
    const user = userEvent.setup();
    const { container } = renderMatrix(true);

    await user.hover(container.querySelectorAll("tbody td")[1]);

    expect([...container.querySelectorAll("tbody td")].some((td) => td.className.includes("text-primary-foreground"))).toBe(false);
  });

  it("fija las etiquetas solo cuando se lo piden", () => {
    // Por defecto no, porque en una ecuación los cuatro operandos comparten un
    // mismo contenedor de scroll y sus columnas de etiquetas se taparían.
    const suelta = renderMatrix(true).container;
    expect(suelta.querySelector("th.sticky")).toBeNull();
    cleanup();

    const fijada = renderMatrix(true, { stickyLabels: true }).container;
    const etiquetaDeFila = within(fijada.querySelector("tbody")!).getByText("v3x");
    expect(etiquetaDeFila.className).toContain("sticky");
    // Sin fondo, al scrollear se transparenta lo que pasa por debajo.
    expect(etiquetaDeFila.className).toContain("bg-background");
  });
});
