// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, useAtomValue } from "jotai";

import { atomElements } from "../store/elements";
import { ElementTable } from "./element-table";

/**
 * Las tres acciones de esta tabla se habían mirado en capturas y ninguna se
 * había *ejecutado*. Dos de ellas son deuda con historia: insertar una fila en
 * el medio es la función que el port había perdido y se restauró en la sesión
 * del 2026-08-10, y «Aplicar a las N barras» es un control que tenía el proyecto
 * original y el port tampoco trajo.
 *
 * Las aserciones van contra el átomo y no contra el DOM de la tabla porque es
 * lo que se quiere fijar: el orden y los valores que quedan en el estado. Los
 * inputs de cada fila no tienen nombre accesible con el que distinguirlos, y
 * agregarles uno para el test sería dejar que el test dicte el markup.
 */

afterEach(cleanup);

/** Espeja el átomo al DOM para poder leerlo con las queries de testing-library. */
function ElementsProbe() {
  const elements = useAtomValue(atomElements);
  return (
    <ul data-testid="probe">
      {elements.map((e) => (
        <li key={e.id}>{`${e.name}:${e.area}:${e.elasticity}`}</li>
      ))}
    </ul>
  );
}

/** `<Provider>` propio: los átomos son de módulo y arrancan con la semilla de 6 barras. */
function renderTable() {
  render(
    <Provider>
      <ElementTable />
      <ElementsProbe />
    </Provider>,
  );
}

const rows = () => [...screen.getByTestId("probe").children].map((li) => li.textContent ?? "");
const names = () => rows().map((row) => row.split(":")[0]);

/**
 * Sonda aparte para los extremos de cada barra: la de arriba ya fija área y
 * módulo, y sumarle campos rompería las aserciones que comparan la fila entera.
 */
function EndpointsProbe() {
  const elements = useAtomValue(atomElements);
  return (
    <ul data-testid="endpoints">
      {elements.map((e) => (
        <li key={e.id}>{`${e.name}:${e.fromNodeId}:${e.toNodeId}`}</li>
      ))}
    </ul>
  );
}

function renderWithEndpoints() {
  render(
    <Provider>
      <ElementTable />
      <EndpointsProbe />
    </Provider>,
  );
}

const endpoints = () => [...screen.getByTestId("endpoints").children].map((li) => li.textContent ?? "");

describe("ElementTable", () => {
  it("agrega una barra al final con el + del encabezado", async () => {
    const user = userEvent.setup();
    renderTable();

    expect(names()).toEqual(["e1", "e2", "e3", "e4", "e5", "e6"]);

    await user.click(screen.getByRole("button", { name: "Agregar una barra al final" }));

    expect(names()).toEqual(["e1", "e2", "e3", "e4", "e5", "e6", "e7"]);
  });

  it("el + de una fila inserta debajo de esa fila, no al final", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Insertar una barra debajo de e2" }));

    // Ésta es la regresión que interesa: con el bug del port, la fila nueva
    // caía al final y había que reordenar a mano.
    expect(names()).toEqual(["e1", "e2", "e7", "e3", "e4", "e5", "e6"]);
  });

  it("la fila insertada hereda área y módulo de la de arriba, no arranca en cero", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Insertar una barra debajo de e2" }));

    // No es comodidad: con área en cero `TrussElement2D` tira error de dominio y
    // el panel de resultados entero desaparece hasta terminar de cargar la fila.
    expect(rows()[2]).toBe(`e7:${rows()[1].split(":").slice(1).join(":")}`);
  });

  it("el − elimina esa fila y deja las demás en su lugar", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Eliminar e3" }));

    expect(names()).toEqual(["e1", "e2", "e4", "e5", "e6"]);
  });

  it("«Aplicar a las N barras» escribe área y módulo en todas, evaluando la expresión", async () => {
    const user = userEvent.setup();
    renderTable();

    const area = screen.getByLabelText("Área");
    await user.clear(area);
    // Entrada estilo Excel: el commit de `FormulaInput` pasa por mathjs, así que
    // este caso cubre las dos cosas de una.
    await user.type(area, "2*3");
    await user.tab();

    await user.click(screen.getByRole("button", { name: "Aplicar a las 6 barras" }));

    expect(rows().every((row) => row.split(":")[1] === "6")).toBe(true);
    // El módulo no se tocó, así que conserva el de la semilla en todas.
    expect(new Set(rows().map((row) => row.split(":")[2])).size).toBe(1);
  });

  it("el rótulo del botón sigue a la cantidad de barras", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Agregar una barra al final" }));

    expect(screen.getByRole("button", { name: "Aplicar a las 7 barras" })).toBeDefined();
  });
});

/**
 * U2. El combobox reemplazó al desplegable plano, así que lo que se fija acá es
 * lo que el desplegable no daba: escribir para filtrar, y que el nudo del otro
 * extremo no se pueda elegir.
 */
describe("ElementTable · elegir los nudos de una barra", () => {
  it("muestra el nudo elegido, y no el id", () => {
    renderWithEndpoints();

    // e1 va de v1 a v2 en la semilla.
    expect(screen.getByLabelText("Nudo de origen de e1").getAttribute("value")).toBe("v1");
    expect(screen.getByLabelText("Nudo de destino de e1").getAttribute("value")).toBe("v2");
  });

  it("escribir filtra la lista y elegir cambia el extremo", async () => {
    const user = userEvent.setup();
    renderWithEndpoints();

    expect(endpoints()[0]).toBe("e1:seed-v1:seed-v2");

    const input = screen.getByLabelText("Nudo de destino de e1");
    await user.click(input);
    await user.keyboard("v3");

    // Con "v3" escrito, v3 es lo único que queda en la lista: eso es lo que el
    // `Select` no podía hacer y es el punto del cambio.
    const opciones = screen.getAllByRole("option");
    expect(opciones.map((o) => o.textContent)).toEqual(["v3"]);

    await user.click(opciones[0]);

    expect(endpoints()[0]).toBe("e1:seed-v1:seed-v3");
  });

  it("escribir cualquier cosa y salir no deja el input diciendo algo que el modelo no dice", async () => {
    const user = userEvent.setup();
    renderWithEndpoints();

    const input = screen.getByLabelText("Nudo de destino de e1");
    await user.click(input);
    await user.keyboard("no existe");
    await user.tab();

    // La lección de la v1: el input y el modelo no pueden divergir. Ahí el
    // valor se confirmaba en `onBlur` y dos caminos lo desmontaban antes, así
    // que la celda mostraba un valor viejo. Ver docs/errores.md.
    expect(endpoints()[0]).toBe("e1:seed-v1:seed-v2");
    expect(input.getAttribute("value")).toBe("v2");
  });

  it("el nudo del otro extremo no se puede elegir", async () => {
    const user = userEvent.setup();
    renderWithEndpoints();

    // e1 ya va de v1 a v2: en el origen, v2 tiene que estar deshabilitado.
    await user.click(screen.getByLabelText("Nudo de origen de e1"));

    const v2 = screen.getAllByRole("option").find((o) => o.textContent === "v2")!;
    expect(v2.getAttribute("aria-disabled")).toBe("true");

    // Y el resto sigue disponible: no se deshabilita la lista, solo ese.
    const v3 = screen.getAllByRole("option").find((o) => o.textContent === "v3")!;
    expect(v3.getAttribute("aria-disabled")).not.toBe("true");
  });
});
