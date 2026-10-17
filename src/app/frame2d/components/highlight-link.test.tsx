// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";

import { HighlightProvider } from "@/components/custom/highlight";
import { ElementTable } from "./element-table";
import { LoadTable } from "./load-table";
import { NodeTable } from "./node-table";
import { SchemaDiagram } from "./schema-diagram";

/**
 * **N3** en `/frame2d`, con lo que tiene de propio: la tabla de cargas. Una
 * carga no es un objeto del dibujo con identidad propia —es de su barra—, así
 * que su fila enciende la barra (y sus dos nudos), y señalar la barra en el
 * dibujo enciende las filas de sus cargas.
 */

afterEach(cleanup);

function renderPage() {
  return render(
    <Provider>
      <HighlightProvider>
        <NodeTable />
        <ElementTable />
        <LoadTable />
        <SchemaDiagram />
      </HighlightProvider>
    </Provider>,
  );
}

const nodeRow = (name: string) => screen.getByRole("checkbox", { name: `Restringir ${name} en X` }).closest("tr")!;
const elementRow = (name: string) => screen.getByRole("button", { name: `Eliminar ${name}` }).closest("tr")!;
const encendida = (row: Element) => row.hasAttribute("data-highlighted");

const encendidas = () => [
  ...["v1", "v2", "v3", "v4"].filter((n) => encendida(nodeRow(n))),
  ...["e1", "e2", "e3"].filter((e) => encendida(elementRow(e))),
  ...["c1"].filter((c) => screen.queryByRole("button", { name: `Eliminar ${c}` }) && encendida(elementRow(c))),
];

describe("N3 · tabla ↔ esquema en /frame2d", () => {
  it("una barra enciende sus dos nudos, desde la tabla", async () => {
    const user = userEvent.setup();
    renderPage();

    // e2 va de v2 a v3.
    await user.hover(elementRow("e2"));
    expect(encendidas()).toEqual(["v2", "v3", "e2"]);
  });

  it("la fila de una carga enciende su barra y los nudos de esa barra", async () => {
    const user = userEvent.setup();
    renderPage();
    // La primera carga nace en la primera barra (e1, de v1 a v2).
    await user.click(screen.getByRole("button", { name: "Agregar una carga al final" }));

    await user.hover(elementRow("c1"));
    expect(encendidas()).toEqual(["v1", "v2", "e1", "c1"]);
  });

  it("señalar la barra en el dibujo enciende la fila de la barra y las de sus cargas", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Agregar una carga al final" }));

    await user.hover(screen.getByLabelText("Barra e1"));
    expect(encendidas()).toEqual(["v1", "v2", "e1", "c1"]);

    await user.hover(screen.getByLabelText("Barra e2"));
    expect(encendidas()).toEqual(["v2", "v3", "e2"]);
  });
});
