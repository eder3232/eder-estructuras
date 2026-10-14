// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";

import { atomRemoveElement } from "../store/elements";
import { ResultsPanel } from "./results-panel";

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

async function openEverything() {
  const user = userEvent.setup();
  for (const trigger of screen.getAllByRole("button", { expanded: false })) {
    if (trigger.getAttribute("data-slot") === "accordion-trigger") await user.click(trigger);
  }
  await user.click(screen.getByRole("switch", { name: "Modo práctica" }));
}

describe("/springs — panel de resultados", () => {
  /**
   * Los componentes que se extrajeron de `/armaduras-2d` venían escritos para
   * barras —«esa barra suma algo», «ejes globales», «barras que llegan»— y se
   * filtraban al pasar a resortes. Este test los atrapa todos de una: con todo
   * desplegado, la palabra no puede aparecer.
   */
  it("con todo desplegado, no habla de barras en ningún lado", async () => {
    setup();
    await openEverything();
    expect(document.body.textContent).not.toMatch(/barra/i);
    expect(screen.getByText(/donde ese resorte suma algo/)).toBeTruthy();
  });

  it("muestra las cinco secciones y el sello de equilibrio sin desplegar", () => {
    setup();
    expect(screen.getByRole("button", { name: /Verificación de equilibrio/ }).textContent).toMatch(
      /Equilibrio verificado/,
    );
    expect(screen.getAllByRole("button").filter((b) => b.getAttribute("data-slot") === "accordion-trigger")).toHaveLength(5);
  });

  it("sin resortes dice por qué no hay resultados, en vez de quedar vacío", () => {
    setup((store) => ["seed-e1", "seed-e2", "seed-e3", "seed-e4"].forEach((id) => store.set(atomRemoveElement, id)));
    expect(screen.getByText("Todavía no hay nada que calcular")).toBeTruthy();
    expect(screen.getByText(/ningún resorte/)).toBeTruthy();
  });

  it("si es un mecanismo, nombra el grupo de nudos que se mueve junto", () => {
    // Sin e1 ni e3, v1, v2 y v3 no están atados a ningún apoyo.
    setup((store) => ["seed-e1", "seed-e3"].forEach((id) => store.set(atomRemoveElement, id)));
    expect(screen.getByText("El cálculo se detuvo: el sistema es un mecanismo")).toBeTruthy();
    expect(screen.getByText(/juntos, la misma distancia/)).toBeTruthy();
  });
});
