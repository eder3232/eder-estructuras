// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";

import { atomNodes, atomUpdateNodeField } from "../../store/nodes";
import { ResultsPanel } from "../results-panel";

/**
 * N5. Lo que se afirma acá es que el veredicto **se ve sin desplegar** —esa fue
 * la decisión de formato— y que la tabla dice de dónde sale.
 *
 * El caso de "no cierra" no se puede sembrar desde la UI, y es a propósito: si
 * el equilibrio no cerrara, sería un bug de la app y no un modelo mal cargado.
 * Ese caso lo cubre `engine/equilibrium.test.ts`, que corre el control con un
 * desplazamiento falseado.
 */

afterEach(cleanup);

function setup(seed?: (store: ReturnType<typeof createStore>) => void) {
  const store = createStore();
  seed?.(store);
  render(
    <Provider store={store}>
      <ResultsPanel />
    </Provider>,
  );
  return store;
}

const trigger = () => screen.getByRole("button", { name: /Verificación de equilibrio/ });

describe("Verificación de equilibrio", () => {
  it("el veredicto se lee con la sección cerrada", () => {
    setup();

    // El sello vive en el título del acordeón: la pregunta "¿puedo confiar en
    // esto?" se contesta sin abrir nada.
    expect(trigger().textContent).toContain("Equilibrio verificado");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("al abrirla, cada nudo tiene su fila y la suma da cero", async () => {
    const user = userEvent.setup();
    const store = setup();

    await user.click(trigger());

    const rows = screen.getAllByRole("row");
    const nombres = store.get(atomNodes).map((n) => n.name);
    for (const nombre of nombres) {
      expect(rows.some((row) => row.textContent?.startsWith(nombre))).toBe(true);
    }

    // Ocho residuos de nudo más los dos del total, todos despreciables. La
    // celda dice "≈ 0" y no "0.0000" a propósito: un cero redondeado no se
    // distingue de un cero de verdad.
    expect(screen.getAllByText("≈ 0")).toHaveLength(2 * nombres.length + 2);
  });

  it("la fila del total no cuenta las barras, porque se cancelan de a pares", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(trigger());

    const total = screen.getAllByRole("row").find((row) => row.textContent?.startsWith("Toda la estructura"))!;
    expect(total.textContent).toContain("se cancelan");
    // Y la suma de las cargas es la que el modelo semilla tiene cargada:
    // 4.8 en x, −12.4 en z.
    expect(total.textContent).toContain("4.8000");
    expect(total.textContent).toContain("-12.4000");
  });

  it("sigue cerrando con otra carga: no es un número guardado", async () => {
    const user = userEvent.setup();
    const store = setup();
    const v3 = store.get(atomNodes)[2];

    store.set(atomUpdateNodeField, { id: v3.id, field: "forceX", value: 25 });
    await user.click(trigger());

    expect(trigger().textContent).toContain("Equilibrio verificado");
    const total = screen.getAllByRole("row").find((row) => row.textContent?.startsWith("Toda la estructura"))!;
    expect(total.textContent).toContain("25.0000");
  });
});
