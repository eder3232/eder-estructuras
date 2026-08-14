// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";

import { atomElements } from "./elements";
import { atomNodes } from "./nodes";
import { atomRestrainedFirst } from "./dof-order";
import { atomPersistableModel, atomResetModel, atomRestoreModel } from "./persistence";
import { MODEL_KEY, MODEL_VERSION, isPersistedModel } from "./persisted-model";

/**
 * N1. Dos cosas distintas que conviene no mezclar: la **guarda de forma**, que
 * decide si lo guardado se puede usar, y el **reset con vuelta atrás**.
 *
 * Y una tercera que solo se puede probar recargando el módulo: que los valores
 * iniciales de los átomos salen de lo guardado. Se lee una sola vez, al
 * evaluarse el módulo, así que el test tiene que volver a evaluarlo.
 */

const nudo = {
  id: "n1",
  name: "a1",
  x: 1,
  z: 2,
  forceX: 0,
  forceZ: 0,
  displacementX: 0,
  displacementZ: 0,
  restrainedX: true,
  restrainedZ: true,
  dofNumberX: 0,
  dofNumberZ: 0,
};
const barra = { id: "e1", name: "b1", fromNodeId: "n1", toNodeId: "n1", area: 1, elasticity: 2 };
const modelo = { nodes: [nudo], elements: [barra], restrainedFirst: true, useDofNumbers: false };

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("la guarda de forma", () => {
  it("acepta un modelo completo", () => {
    expect(isPersistedModel(modelo)).toBe(true);
  });

  it("un solo campo mal descarta el modelo entero", () => {
    // A propósito: un modelo a medio validar produce matrices con NaN y errores
    // del motor que el alumno no puede corregir, porque no los causó él.
    expect(isPersistedModel({ ...modelo, nodes: [{ ...nudo, x: "1" }] })).toBe(false);
    expect(isPersistedModel({ ...modelo, elements: [{ ...barra, area: null }] })).toBe(false);
    expect(isPersistedModel({ ...modelo, restrainedFirst: undefined })).toBe(false);
  });

  it("rechaza lo que ni siquiera es un modelo", () => {
    for (const basura of [null, 42, "x", [], {}]) expect(isPersistedModel(basura)).toBe(false);
  });

  it("rechaza un número que no es finito", () => {
    // `JSON.stringify` convierte NaN e Infinity en `null`, así que esto llega
    // como null y no como número — pero la guarda tampoco los dejaría pasar.
    expect(isPersistedModel({ ...modelo, nodes: [{ ...nudo, x: Number.NaN }] })).toBe(false);
  });
});

describe("reset y deshacer", () => {
  it("vuelve al ejemplo inicial y devuelve lo que había", () => {
    const store = createStore();
    store.set(atomRestoreModel, modelo);

    const previo = store.set(atomResetModel);

    expect(store.get(atomNodes).map((n) => n.name)).toEqual(["v1", "v2", "v3", "v4"]);
    expect(store.get(atomElements)).toHaveLength(6);
    expect(store.get(atomRestrainedFirst)).toBe(false);
    // Lo devuelto es lo que hace posible el "deshacer".
    expect(previo.nodes.map((n) => n.name)).toEqual(["a1"]);
    expect(previo.restrainedFirst).toBe(true);
  });

  it("deshacer devuelve exactamente lo que había, flags incluidos", () => {
    const store = createStore();
    store.set(atomRestoreModel, modelo);
    const previo = store.set(atomResetModel);

    store.set(atomRestoreModel, previo);

    expect(store.get(atomPersistableModel)).toEqual(modelo);
  });

  it("el ejemplo inicial se entrega en copia: resetear dos veces no arrastra ediciones", () => {
    const store = createStore();
    store.set(atomResetModel);
    store.get(atomNodes)[0].name = "editado a mano";

    store.set(atomResetModel);

    expect(store.get(atomNodes)[0].name).toBe("v1");
  });
});

describe("al arrancar", () => {
  it("los átomos toman lo guardado, no el ejemplo inicial", async () => {
    localStorage.setItem(MODEL_KEY, JSON.stringify({ v: MODEL_VERSION, data: modelo }));
    vi.resetModules();

    const { atomNodes: nodosFrescos } = await import("./nodes");
    const { atomRestrainedFirst: ordenFresco } = await import("./dof-order");
    const store = createStore();

    expect(store.get(nodosFrescos).map((n) => n.name)).toEqual(["a1"]);
    expect(store.get(ordenFresco)).toBe(true);
  });

  it("con algo guardado que no se entiende, arranca con el ejemplo inicial y lo dice", async () => {
    localStorage.setItem(MODEL_KEY, JSON.stringify({ v: MODEL_VERSION + 1, data: modelo }));
    vi.resetModules();

    const { atomNodes: nodosFrescos } = await import("./nodes");
    const { storedModelDiscarded } = await import("./persisted-model");
    const store = createStore();

    expect(store.get(nodosFrescos).map((n) => n.name)).toEqual(["v1", "v2", "v3", "v4"]);
    expect(storedModelDiscarded).toBe(true);
  });
});
