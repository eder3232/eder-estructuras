// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, useAtomValue } from "jotai";

import { HighlightProvider } from "@/components/custom/highlight";
import { atomElements } from "../../store/elements";
import { atomResults } from "../../store/results";
import { GlobalEquation } from "./global-equation";

/**
 * N4. Lo que se fija es la respuesta a *¿por qué aparece un número en esta
 * celda y no en la de al lado?* — que es topológica: una barra aporta a
 * `K[i][j]` solo si toca los dos nudos.
 *
 * El cálculo puro está testeado aparte (`engine/cell-contributions.test.ts`);
 * acá lo que importa es que el mouse llegue hasta él.
 */

afterEach(cleanup);

function Harness() {
  const results = useAtomValue(atomResults);
  const elements = useAtomValue(atomElements);
  if (results.status !== "ok") return <p>sin resultados</p>;
  return (
    <GlobalEquation
      assembly={results.solved.assembly}
      solved={results.solved}
      nodesById={results.nodesById}
      elements={elements}
    />
  );
}

function renderEquation() {
  render(
    <Provider>
      <HighlightProvider>
        <Harness />
      </HighlightProvider>
    </Provider>,
  );
}

/** La celda `(fila, columna)` de la matriz global, que es la segunda tabla. */
function celda(fila: number, columna: number) {
  const tabla = screen.getAllByRole("table")[1];
  const filas = [...tabla.querySelectorAll("tbody tr")];
  // La primera celda de cada fila es la etiqueta.
  return filas[fila].querySelectorAll("td")[columna];
}

describe("GlobalEquation · de dónde sale el número de una celda", () => {
  it("sin mouse encima, invita a pasarlo", () => {
    renderEquation();

    expect(screen.getByText(/Pasá el mouse por una celda de K/i)).toBeDefined();
  });

  it("en la diagonal de un nudo nombra todas las barras que llegan a ese nudo", async () => {
    const user = userEvent.setup();
    renderEquation();

    // Fila 0 = v1x en la semilla. A v1 llegan e1, e3 y e5.
    await user.hover(celda(0, 0));

    expect(screen.getByText(/le aportan 3 barras/i)).toBeDefined();
    const lista = screen.getByRole("list");
    expect([...lista.children].map((li) => li.textContent?.split(":")[0])).toEqual(["e1", "e3", "e5"]);
  });

  it("en un par de nudos sin barra que los una, dice que no hay nada que sumar", async () => {
    const user = userEvent.setup();
    renderEquation();

    // v1 (filas 0-1) y v2 (filas 2-3) sí están unidos por e1, así que hay que
    // buscar otro par… en la semilla todos los pares tienen barra salvo por el
    // cruce de ejes del mismo nudo. Se usa entonces la celda v1x·v2z, que sí
    // tiene barra (e1) pero aporta cero por ser horizontal.
    await user.hover(celda(0, 3));

    expect(screen.getByText(/no tiene rigidez en esa dirección/i)).toBeDefined();
  });

  it("al sacar el mouse vuelve la invitación", async () => {
    const user = userEvent.setup();
    renderEquation();

    await user.hover(celda(0, 0));
    await user.unhover(celda(0, 0));

    expect(screen.getByText(/Pasá el mouse por una celda de K/i)).toBeDefined();
  });
});
