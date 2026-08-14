// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore, useAtomValue } from "jotai";

import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";
import { atomNodes } from "../store/nodes";
import { MODEL_KEY } from "../store/persisted-model";
import { ModelPersistence, ResetModelButton } from "./model-persistence";
import { NodeTable } from "./node-table";

/**
 * N1 de punta a punta: que editar guarde, y que el reset se pueda deshacer.
 *
 * Lo que **no** se puede probar acá es el otro lado —que al recargar los átomos
 * arranquen con lo guardado—, porque eso pasa al evaluarse el módulo. Está en
 * `store/persistence.test.ts`, que vuelve a importarlo.
 */

afterEach(() => {
  // El estado de los toasts vive en un módulo de `sonner`, no en el árbol:
  // sin esto, el aviso de un test sigue en la cola del siguiente y el
  // "Deshacer" que se busca puede no ser el que se acaba de disparar.
  toast.dismiss();
  cleanup();
  localStorage.clear();
});

/** Espeja el átomo: el orden de las filas no se lee del markup. */
function NodesProbe() {
  return <span data-testid="probe">{useAtomValue(atomNodes).map((n) => n.name).join(",")}</span>;
}

function setup() {
  const store = createStore();
  render(
    <Provider store={store}>
      <ModelPersistence />
      <ResetModelButton />
      <NodeTable />
      <NodesProbe />
      <Toaster />
    </Provider>,
  );
  return store;
}

const nombres = () => screen.getByTestId("probe").textContent;
const guardado = () => JSON.parse(localStorage.getItem(MODEL_KEY) ?? "null");

describe("persistencia del modelo", () => {
  it("cada cambio se guarda, con su versión", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Agregar un nudo al final" }));

    expect(guardado().v).toBe(1);
    expect(guardado().data.nodes).toHaveLength(5);
    // El modelo entero, no solo los nudos: los flags de orden son parte del
    // ejercicio y tienen que viajar con él.
    expect(guardado().data.restrainedFirst).toBe(false);
    expect(guardado().data.elements).toHaveLength(6);
  });

  it("los decimales y la notación compacta **no** entran en la clave del modelo", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Agregar un nudo al final" }));

    // Son preferencias de la app, valen para los cuatro sistemas y van en su
    // propia clave el día que se persistan. Si esto falla, alguien mezcló las
    // dos cosas.
    expect(Object.keys(guardado().data).sort()).toEqual(["elements", "nodes", "restrainedFirst", "useDofNumbers"]);
  });

  it("el reset vuelve al ejemplo inicial y se puede deshacer", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Agregar un nudo al final" }));
    expect(nombres()).toBe("v1,v2,v3,v4,v5");

    await user.click(screen.getByRole("button", { name: /Volver al ejemplo inicial/ }));
    expect(nombres()).toBe("v1,v2,v3,v4");

    // El undo es lo que reemplaza al diálogo de confirmación: no frena al que
    // sabe lo que quiere, y salva igual al que se dio cuenta después.
    await user.click(await screen.findByRole("button", { name: "Deshacer" }));
    expect(nombres()).toBe("v1,v2,v3,v4,v5");
  });

  it("deshacer también devuelve lo guardado, no solo lo que se ve", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Agregar un nudo al final" }));
    await user.click(screen.getByRole("button", { name: /Volver al ejemplo inicial/ }));
    expect(guardado().data.nodes).toHaveLength(4);

    await user.click(await screen.findByRole("button", { name: "Deshacer" }));

    expect(guardado().data.nodes).toHaveLength(5);
  });
});
