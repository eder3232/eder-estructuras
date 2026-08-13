// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";

import { atomElements, atomRemoveElement } from "../store/elements";
import { atomAddNode, atomNodes, atomRemoveNode, atomToggleNodeRestrained, seedNodeIds } from "../store/nodes";
import { ErrorsPanel } from "./errors-panel";
import { ResultsPanel } from "./results-panel";

/**
 * El panel devolvía `null` en todo lo que no fuera "resuelto", así que la
 * sección quedaba con su título, sus controles al lado y nada debajo: se leía
 * como si la app se hubiera roto. Estos tests fijan que cada estado diga por
 * qué no hay resultados.
 *
 * El estado se siembra con las **acciones del store**, las mismas que usan las
 * tablas, porque `atomNodes` y `atomElements` son derivados de solo lectura —y
 * de paso el camino que se ejercita es el que recorre el usuario.
 */

afterEach(cleanup);

/** Store propio por test: los átomos son de módulo y arrancan con la semilla. */
function setup(seed?: (store: ReturnType<typeof createStore>) => void) {
  const store = createStore();
  seed?.(store);
  render(
    <Provider store={store}>
      <ErrorsPanel />
      <ResultsPanel />
    </Provider>,
  );
  return store;
}

const clearNodes = (store: ReturnType<typeof createStore>) => {
  for (const node of store.get(atomNodes)) store.set(atomRemoveNode, node.id);
};
const clearElements = (store: ReturnType<typeof createStore>) => {
  for (const element of store.get(atomElements)) store.set(atomRemoveElement, element.id);
};

/** El acordeón de resultados: si está, hay resultados. */
const accordion = () => screen.queryByRole("button", { name: /Ensamblaje de la matriz global/ });
/** Los controles del encabezado, que solo tienen sentido si hay números. */
const compactControl = () => screen.queryByLabelText("Notación compacta");

describe("ResultsPanel", () => {
  it("con el modelo semilla muestra los resultados y sus controles", () => {
    setup();

    expect(accordion()).not.toBeNull();
    expect(compactControl()).not.toBeNull();
  });

  it("el título de la sección no desaparece nunca", () => {
    setup(clearNodes);

    expect(screen.getByRole("heading", { name: "Resultados" })).toBeDefined();
  });

  it("sin nudos dice que no hay nada que calcular, y esconde acordeón y controles", () => {
    setup(clearNodes);

    expect(screen.getByText(/Todavía no hay nada que calcular/i)).toBeDefined();
    expect(screen.getByText(/al menos un nudo y una barra/)).toBeDefined();
    expect(accordion()).toBeNull();
    // La otra mitad de lo que hacía ver rota la sección: formatear números
    // cuando no hay ninguno.
    expect(compactControl()).toBeNull();
  });

  it("con nudos y sin barras nombra las barras que faltan, no un mecanismo", () => {
    setup(clearElements);

    expect(screen.getByText(/4 nudos pero ninguna barra/)).toBeDefined();
    // Sin barras la `Kff` sale toda de ceros y el motor lo reporta —con razón—
    // como mecanismo, pero eso es una respuesta rebuscada para "faltan las
    // barras". El chequeo previo del store es lo que fija este test.
    expect(screen.queryByText(/es un mecanismo/)).toBeNull();
    expect(accordion()).toBeNull();
  });

  it("un error de datos dice cuántos son y qué filas los causan", () => {
    // Borrar un nudo no borra las barras que lo referencian: es el camino más
    // corto a un modelo inconsistente, y uno que el usuario recorre de verdad.
    setup((store) => store.set(atomRemoveNode, seedNodeIds.v3));

    expect(screen.getByText(/No se pudo calcular/i)).toBeDefined();
    const detail = screen.getByText(/impiden armar el sistema/);
    expect(detail.textContent).toContain("barra e2");
    expect(detail.textContent).toContain("barra e3");
    expect(detail.textContent).toContain("barra e6");
    expect(accordion()).toBeNull();
  });

  it("una advertencia se dice **y** los resultados se muestran igual", () => {
    // Un nudo agregado, restringido y sin conectar: no rompe nada —los apoyos
    // lo sostienen— pero no aporta. Si estuviera libre sería un mecanismo, o
    // sea un error, y no llegaría hasta acá.
    setup((store) => {
      store.set(atomAddNode);
      const nuevo = store.get(atomNodes).at(-1)!;
      store.set(atomToggleNodeRestrained, { id: nuevo.id, axis: "x" });
      store.set(atomToggleNodeRestrained, { id: nuevo.id, axis: "z" });
    });

    // Esta es la regla, y es la que el proyecto original violaba: el aviso
    // viajaba en el mismo array que decidía si los resultados se rendían, así
    // que los hacía desaparecer. Ver docs/errores.md.
    expect(screen.getByText(/No tiene ninguna barra conectada/)).toBeDefined();
    expect(accordion()).not.toBeNull();
    expect(compactControl()).not.toBeNull();

    // Y la advertencia nombra la fila, que el motor solo sabe señalar por id.
    expect(screen.getByText(/Revisá nudo v5/)).toBeDefined();
  });

  it("un mecanismo se explica en el lugar de los resultados, y una sola vez", () => {
    // Armadura sin ningún apoyo horizontal: se puede trasladar entera en x sin
    // que ninguna barra cambie de longitud.
    setup((store) => {
      store.set(atomToggleNodeRestrained, { id: seedNodeIds.v1, axis: "x" });
      store.set(atomToggleNodeRestrained, { id: seedNodeIds.v2, axis: "x" });
    });

    expect(screen.getByText(/El cálculo se detuvo: la estructura es un mecanismo/i)).toBeDefined();
    expect(screen.getByText(/sin deformar\s+ninguna barra/)).toBeDefined();
    // El diagnóstico salía además como alerta roja arriba, atribuido a un
    // elemento que no existe (`refId: "-"`). Ahora se filtra de las alertas.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(accordion()).toBeNull();
  });
});
