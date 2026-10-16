// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";

import { atomElementsBase, type ElementRow } from "@/app/springs/store/elements";
import { atomNodesBase, type NodeRow } from "@/app/springs/store/nodes";
import { ResultsPanel } from "@/app/springs/components/results-panel";
import { COLLAPSE_ABOVE_DOFS } from "./assembly-steps";
import { HEATMAP_ABOVE_DOFS } from "./global-equation";
import { heatColor, MatrixTable } from "./matrix-table";

/**
 * Las herramientas de matrices grandes del paso 3 de `/armaduras-3d`
 * (docs/armaduras-3d-v1.md). Se prueban sobre `/springs` porque es el sistema
 * donde es más barato armar un modelo de 20 grados de libertad: una cadena de
 * resortes, un grado por nudo. Los componentes son los mismos en los tres.
 */

afterEach(cleanup);

/** Una cadena de `n` nudos empotrada en los dos extremos, con una carga en el medio. */
function chain(n: number): { nodes: NodeRow[]; elements: ElementRow[] } {
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    name: `n${i}`,
    force: i === Math.floor(n / 2) ? 10 : 0,
    displacement: 0,
    restrained: i === 0 || i === n - 1,
    dofNumber: 0,
  }));
  const elements = Array.from({ length: n - 1 }, (_, i) => ({
    id: `e${i}`,
    name: `e${i}`,
    fromNodeId: `n${i}`,
    toNodeId: `n${i + 1}`,
    k: 5,
  }));
  return { nodes, elements };
}

async function renderChain(n: number) {
  const store = createStore();
  const { nodes, elements } = chain(n);
  store.set(atomNodesBase, nodes);
  store.set(atomElementsBase, elements);
  render(
    <Provider store={store}>
      <ResultsPanel />
    </Provider>,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: /Ensamblaje de la matriz global/ }));
}

/** Las matrices de los pasos que están a la vista, y nada más (no la `K` de la ecuación global). */
const stepTables = () => within(screen.getByText(/La matriz global se arma/).parentElement!).queryAllByRole("table");

describe("D14 · los pasos de ensamblaje", () => {
  it(`hasta ${COLLAPSE_ABOVE_DOFS} grados de libertad, todos abiertos`, async () => {
    await renderChain(COLLAPSE_ABOVE_DOFS);
    expect(screen.queryByText(/van cerrados/)).toBeNull();
    // Un paso por resorte.
    expect(stepTables()).toHaveLength(COLLAPSE_ABOVE_DOFS - 1);
  });

  it("pasado el límite van cerrados, y se abren de a uno", async () => {
    const n = COLLAPSE_ABOVE_DOFS + 1;
    await renderChain(n);
    expect(screen.getByText(/van cerrados/)).toBeTruthy();
    expect(stepTables()).toHaveLength(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Paso 1:/ }));
    expect(stepTables()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /Paso 2:/ }));
    expect(stepTables()).toHaveLength(1);
  });
});

describe("D13 · K como mapa", () => {
  it("con pocos grados de libertad arranca en números, y el interruptor la pasa a mapa", async () => {
    await renderChain(6);
    const toggle = screen.getByRole("switch", { name: /como mapa/ });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText(/para ver su valor/)).toBeNull();

    await userEvent.setup().click(toggle);
    expect(screen.getByText(/para ver su valor/)).toBeTruthy();
  });

  it(`pasados ${HEATMAP_ABOVE_DOFS} grados de libertad arranca como mapa`, async () => {
    await renderChain(HEATMAP_ABOVE_DOFS + 1);
    expect(screen.getByRole("switch", { name: /como mapa/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("en el mapa no hay números a la vista", () => {
    render(
      <Provider>
        <MatrixTable
          matrix={[
            [10, -5],
            [-5, 10],
          ]}
          labels={["a", "b"]}
          heatmap
        />
      </Provider>,
    );
    const table = screen.getByRole("table");
    expect(within(table).queryByText("10.0000")).toBeNull();
    // El `0` de cada celda es invisible: está solo para darle a la fila su alto.
    expect(table.querySelector("td span")?.className).toBe("invisible");
  });
});

describe("heatColor", () => {
  it("el cero no lleva color, y el valor más chico sí", () => {
    expect(heatColor(0, 100)).toBeUndefined();
    expect(heatColor(1e-12, 100)).toBeUndefined();
    expect(heatColor(1, 100)).toMatch(/15\.8%/);
  });

  it("el signo elige el color y la magnitud la intensidad", () => {
    expect(heatColor(100, 100)).toMatch(/oklch\(0\.62 0\.17 250\) 100\.0%/);
    expect(heatColor(-50, 100)).toMatch(/oklch\(0\.63 0\.21 30\) 57\.5%/);
  });

  it("una matriz toda en cero no divide por cero", () => {
    expect(heatColor(0, 0)).toBeUndefined();
  });
});
