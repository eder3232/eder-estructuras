// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";

import { atomElementsBase } from "../store/elements";
import { ExcelExportButton } from "./excel-export-button";

/**
 * El libro lleva los números del motor y la partición sale de la solución, así
 * que sin un modelo que resuelva no hay nada que exportar. Lo que se fija acá
 * es que el botón lo sepa y lo diga, en vez de fallar al apretarlo.
 *
 * La generación en sí no se prueba en este entorno —happy-dom no tiene
 * `canvas` para el PNG del esquema—: está probada contra el motor en
 * `store/excel-workbook.test.ts` y de punta a punta en Chrome y Excel (ver
 * `docs/excel-export.md`).
 */

afterEach(cleanup);

function setup(store = createStore()) {
  render(
    <Provider store={store}>
      <ExcelExportButton />
    </Provider>,
  );
  return screen.getByRole("button", { name: /Descargar Excel/ });
}

describe("botón de exportar a Excel", () => {
  it("está habilitado con el ejemplo inicial, que resuelve", () => {
    expect((setup() as HTMLButtonElement).disabled).toBe(false);
  });

  it("se apaga sin un modelo que resuelva, y dice por qué", () => {
    const store = createStore();
    store.set(atomElementsBase, []);
    const button = setup(store) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.title).toBe("Hace falta un modelo que resuelva");
  });
});
