// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";

import { HighlightProvider } from "@/components/custom/highlight";
import { ElementTable } from "./element-table";
import { NodeTable } from "./node-table";
import { SchemaDiagram } from "./schema-diagram";

/**
 * **N3**: la tabla y el dibujo son el mismo modelo mirado de dos formas, así
 * que el resaltado tiene que viajar en las dos direcciones. El test monta las
 * tres piezas bajo el mismo proveedor —que es como están en la página— porque
 * lo que se afirma es justamente lo que pasa *entre* ellas: por separado cada
 * una funciona y no hay nada que verificar.
 *
 * La invariante que fijan estos casos: **una fila se enciende exactamente
 * cuando se enciende su dibujo**. Una barra prende sus dos nudos en los dos
 * lados; un nudo no prende ninguna barra en ninguno.
 */

afterEach(cleanup);

function renderPage() {
  return render(
    <Provider>
      <HighlightProvider>
        <NodeTable />
        <ElementTable />
        <SchemaDiagram />
      </HighlightProvider>
    </Provider>,
  );
}

/** La fila de un nudo, agarrada por la casilla que ya tenía nombre accesible. */
const nodeRow = (name: string) =>
  screen.getByRole("checkbox", { name: `Restringir ${name} en x` }).closest("tr")!;

/** La de una barra, por su botón de eliminar. */
const elementRow = (name: string) => screen.getByRole("button", { name: `Eliminar ${name}` }).closest("tr")!;

const encendida = (row: Element) => row.hasAttribute("data-highlighted");

/** Las filas encendidas, por nombre, en las dos tablas. */
const encendidas = () => [
  ...["v1", "v2", "v3", "v4"].filter((n) => encendida(nodeRow(n))),
  ...["e1", "e2", "e3", "e4", "e5", "e6"].filter((e) => encendida(elementRow(e))),
];

describe("N3 · tabla ↔ diagrama", () => {
  it("pasar el mouse por una fila de nudo lo señala, y no señala ninguna barra", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.hover(nodeRow("v3"));

    expect(encendidas()).toEqual(["v3"]);

    // El dibujo apaga lo demás —sin atenuar, resaltar no se lee— y **apaga
    // también los apoyos y las flechas del nudo que se apagó**: son de él. Con
    // la semilla eso son las 6 barras, los otros 3 nudos, los 2 apoyos y la
    // única fuerza que no es de v3. Lo encontró la captura: con las flechas a
    // plena intensidad sobre una figura al 20%, lo más fuerte de la pantalla
    // pasaba a ser justo lo que no se estaba señalando.
    expect(container.querySelectorAll("g.opacity-20")).toHaveLength(6 + 3 + 2 + 1);

    await user.unhover(nodeRow("v3"));
    expect(encendidas()).toEqual([]);
  });

  it("una barra enciende también los dos nudos que toca", async () => {
    const user = userEvent.setup();
    renderPage();

    // e3 va de v1 a v3.
    await user.hover(elementRow("e3"));

    expect(encendidas()).toEqual(["v1", "v3", "e3"]);
  });

  it("y al revés: el mouse sobre el dibujo enciende la fila", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.hover(screen.getByLabelText("Barra e3"));
    expect(encendidas()).toEqual(["v1", "v3", "e3"]);

    await user.unhover(screen.getByLabelText("Barra e3"));
    await user.hover(screen.getByLabelText("Nudo v4"));
    expect(encendidas()).toEqual(["v4"]);
  });

  it("las zonas sensibles del dibujo son mucho más gruesas que la barra", () => {
    renderPage();

    // Una barra mide 1.5 px: cazarla con el mouse a esa escala es imposible.
    // El grosor va en píxeles y no en unidades del modelo, que es la trampa de
    // este módulo — de ahí el `non-scaling-stroke`.
    const hit = screen.getByLabelText("Barra e3");
    expect(Number(hit.getAttribute("stroke-width"))).toBeGreaterThan(8);
    expect(hit.getAttribute("vector-effect")).toBe("non-scaling-stroke");
  });
});
