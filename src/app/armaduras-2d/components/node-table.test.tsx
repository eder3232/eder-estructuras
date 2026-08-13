// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, useAtomValue } from "jotai";

import { atomNodes } from "../store/nodes";
import { NodeTable } from "./node-table";

/**
 * La tabla de nudos no tenía ningún test: los que había eran de la de barras.
 * Estos fijan las dos cosas que U1 cambió y que M1b va a extender — la
 * agrupación del encabezado y el nombre accesible de las casillas de
 * restricción, que al pasar de "Restr. X" a "X" se habrían quedado sin
 * ninguno.
 */

afterEach(cleanup);

/** Espeja el átomo al DOM: el estado de una casilla no se lee del markup. */
function NodesProbe() {
  const nodes = useAtomValue(atomNodes);
  return (
    <ul data-testid="probe">
      {nodes.map((n) => (
        <li key={n.id}>{`${n.name}:${n.restrainedX}:${n.restrainedZ}`}</li>
      ))}
    </ul>
  );
}

function renderTable() {
  render(
    <Provider>
      <NodeTable />
      <NodesProbe />
    </Provider>,
  );
}

const rows = () => [...screen.getByTestId("probe").children].map((li) => li.textContent ?? "");
const names = () => rows().map((row) => row.split(":")[0]);

describe("NodeTable", () => {
  it("el encabezado agrupa las magnitudes y deja el eje abajo", () => {
    renderTable();

    // Cada grupo cubre sus dos ejes: es lo que permite que el rótulo largo
    // deje de fijarle el ancho a cada columna.
    for (const grupo of ["Coordenadas", "Fuerza", "Desplazamiento", "Restringido"]) {
      expect(screen.getByText(grupo).getAttribute("colspan")).toBe("2");
    }

    // Cuatro grupos de dos ejes cada uno.
    expect(screen.getAllByText("X")).toHaveLength(4);
    expect(screen.getAllByText("Z")).toHaveLength(4);
  });

  it("las casillas de restricción se siguen pudiendo nombrar, y restringen", async () => {
    const user = userEvent.setup();
    renderTable();

    // v3 es el nudo libre de la semilla.
    expect(rows()[2]).toBe("v3:false:false");

    await user.click(screen.getByRole("checkbox", { name: "Restringir v3 en x" }));

    expect(rows()[2]).toBe("v3:true:false");
  });

  it("el + de una fila inserta debajo de esa fila, no al final", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Insertar un nudo debajo de v2" }));

    expect(names()).toEqual(["v1", "v2", "v5", "v3", "v4"]);
  });
});
