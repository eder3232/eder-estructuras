// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore, useAtomValue } from "jotai";

import { DofOrderTable } from "@/components/custom/dof-order-table";
import { atomToggleNodeRestrained, atomUpdateNodeField, seedNodeIds } from "../../store/nodes";
import { atomResults } from "../../store/results";
import { DofOrderControl } from "./dof-order-control";

/**
 * M1a. Lo que importa del checkbox es que efectivamente cambie el orden con el
 * que se numeran los grados de libertad — y eso se ve en la tabla de orden,
 * que es justo la que tiene al lado.
 *
 * El invariante fuerte (que los resultados no cambien) se fija en el motor,
 * en `engine/dof-order.test.ts`.
 */

afterEach(cleanup);

/** La tabla de orden leyendo el átomo, que es como la arma el panel real. */
function OrderTable() {
  const results = useAtomValue(atomResults);
  if (results.status !== "ok") return <p>sin resultados</p>;
  return (
    <DofOrderTable
      dofOrder={results.solved.assembly.dofOrder}
      nodesById={results.nodesById}
      dofLabels={["x", "z"]}
    />
  );
}

/**
 * Un modelo donde los grupos quedan **intercalados** en orden de inserción, que
 * es el único caso donde el toggle hace algo visible: en la semilla los dos
 * nudos restringidos ya son los primeros.
 */
function setup() {
  const store = createStore();
  // v4 pasa a restringido; primero hay que sacarle la carga, porque una fuerza
  // en un grado restringido es un error de dominio.
  store.set(atomUpdateNodeField, { id: seedNodeIds.v4, field: "forceZ", value: 0 });
  store.set(atomToggleNodeRestrained, { id: seedNodeIds.v4, axis: "x" });
  store.set(atomToggleNodeRestrained, { id: seedNodeIds.v4, axis: "z" });

  render(
    <Provider store={store}>
      <DofOrderControl />
      <OrderTable />
    </Provider>,
  );
  return store;
}

/** Los nudos en el orden en que la tabla los lista. */
const ordenDeNudos = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.children[1].textContent);

describe("DofOrderControl", () => {
  it("arranca apagado: el orden es el de inserción", () => {
    setup();

    expect(ordenDeNudos()).toEqual(["v1", "v1", "v2", "v2", "v3", "v3", "v4", "v4"]);
  });

  it("al marcarlo, los restringidos suben y el orden dentro de cada grupo se conserva", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("checkbox", { name: /restringidos van arriba/i }));

    // v3 es el único libre y queda al final; v1, v2 y v4 mantienen su orden
    // relativo, que es lo que hace que mover una fila en la tabla siga
    // significando lo mismo.
    expect(ordenDeNudos()).toEqual(["v1", "v1", "v2", "v2", "v4", "v4", "v3", "v3"]);
  });

  it("y se puede volver", async () => {
    const user = userEvent.setup();
    setup();
    const checkbox = screen.getByRole("checkbox", { name: /restringidos van arriba/i });

    await user.click(checkbox);
    await user.click(checkbox);

    expect(ordenDeNudos()).toEqual(["v1", "v1", "v2", "v2", "v3", "v3", "v4", "v4"]);
  });
});
