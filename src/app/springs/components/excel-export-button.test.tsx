// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";

import { atomElementsBase } from "../store/elements";
import { ExcelExportButton } from "./excel-export-button";

afterEach(cleanup);

function setup(store = createStore()) {
  render(
    <Provider store={store}>
      <ExcelExportButton />
    </Provider>,
  );
  return screen.getByRole("button", { name: /Descargar Excel/ }) as HTMLButtonElement;
}

describe("/springs — botón de exportar a Excel", () => {
  it("está habilitado con el ejemplo inicial, que resuelve", () => {
    expect(setup().disabled).toBe(false);
  });

  it("se apaga sin un modelo que resuelva, y dice por qué", () => {
    const store = createStore();
    store.set(atomElementsBase, []);
    const button = setup(store);
    expect(button.disabled).toBe(true);
    expect(button.title).toBe("Hace falta un modelo que resuelva");
  });
});
