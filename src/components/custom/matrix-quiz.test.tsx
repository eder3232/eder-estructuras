// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";

import { cellKey } from "./matrix-quiz-check";
import { PositionsQuiz, ValuesQuiz } from "./matrix-quiz";

/**
 * El modo práctica es interacción pura: sin ejercitar los clicks, lo único que
 * se puede afirmar de una captura es que los recuadros están dibujados.
 */

afterEach(cleanup);

describe("PositionsQuiz", () => {
  const labels = ["v1x", "v1z", "v2x", "v2z"];
  const esperadas = [cellKey(0, 0), cellKey(0, 2), cellKey(2, 0), cellKey(2, 2)];

  function renderQuiz() {
    render(<PositionsQuiz labels={labels} expected={esperadas} title="¿Dónde aporta e1?" />);
  }

  it("marca y desmarca una celda con el click", async () => {
    const user = userEvent.setup();
    renderQuiz();
    const celda = screen.getByRole("button", { name: "v1x con v1x" });

    await user.click(celda);
    expect(celda.getAttribute("aria-pressed")).toBe("true");

    await user.click(celda);
    expect(celda.getAttribute("aria-pressed")).toBe("false");
  });

  it("dice cuántas faltan y cuántas sobran, no un puntaje", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await user.click(screen.getByRole("button", { name: "v1x con v1x" })); // correcta
    await user.click(screen.getByRole("button", { name: "v1z con v1z" })); // de más
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    // Faltar y sobrar son errores distintos y se corrigen distinto, así que se
    // informan por separado.
    const resumen = screen.getByText(/faltan 3/).textContent ?? "";
    expect(resumen).toContain("1 de 4 bien");
    expect(resumen).toContain("faltan 3");
    expect(resumen).toContain("sobran 1");
  });

  it("celebra sin ambigüedad cuando están todas", async () => {
    const user = userEvent.setup();
    renderQuiz();

    for (const [fila, columna] of [
      ["v1x", "v1x"],
      ["v1x", "v2x"],
      ["v2x", "v1x"],
      ["v2x", "v2x"],
    ]) {
      await user.click(screen.getByRole("button", { name: `${fila} con ${columna}` }));
    }
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    expect(screen.getByText("Las 4 posiciones, bien.")).toBeDefined();
  });

  it("«empezar de nuevo» borra lo marcado y la corrección", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await user.click(screen.getByRole("button", { name: "v1z con v1z" }));
    await user.click(screen.getByRole("button", { name: "Verificar" }));
    await user.click(screen.getByRole("button", { name: "Empezar de nuevo" }));

    expect(screen.getByRole("button", { name: "v1z con v1z" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText(/sobran/)).toBeNull();
  });
});

describe("ValuesQuiz", () => {
  const expected = [
    [6666.6667, -6666.6667],
    [-6666.6667, 6666.6667],
  ];

  function renderQuiz() {
    render(
      <Provider>
        <ValuesQuiz rowLabels={["v1x", "v2x"]} colLabels={["v1x", "v2x"]} expected={expected} title="La matriz de e1" />
      </Provider>,
    );
  }

  it("acepta el redondeo y también la cuenta sin resolver", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await user.type(screen.getByLabelText("v1x con v1x"), "6666.67");
    await user.type(screen.getByLabelText("v2x con v2x"), "2e7*0.001/3");
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    // El resumen viene partido en dos nodos (`<span>2</span> de 4 bien`), así
    // que se mira el texto del contenedor.
    expect(screen.getByText(/de 4 bien/).textContent).toContain("2 de 4 bien");
  });

  it("«mostrar solución» reemplaza los campos por los valores del motor", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await user.click(screen.getByRole("button", { name: "Mostrar solución" }));

    expect(screen.queryByLabelText("v1x con v1x")).toBeNull();
    // Dos celdas comparten el valor: lo que importa es que ya no haya campos.
    expect(screen.getAllByText("6666.6667").length).toBeGreaterThan(0);

    // Y se puede volver a intentar, que es lo que hace que sea práctica y no
    // una respuesta.
    await user.click(screen.getByRole("button", { name: "Volver a intentar" }));
    expect(screen.getByLabelText("v1x con v1x")).toBeDefined();
  });
});
