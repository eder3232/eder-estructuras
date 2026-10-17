// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";

import { atomElements } from "./elements";
import { atomNodes } from "./nodes";
import { atomPersistableModel, atomResetModel, atomRestoreModel } from "./persistence";
import { MODEL_KEY, MODEL_VERSION, isPersistedModel } from "./persisted-model";

/**
 * N1 en `/armaduras-3d`, con la misma técnica que `/armaduras-2d` y `/springs`:
 * la guarda de forma, el reset con vuelta atrás, y —recargando el módulo— que
 * los átomos arrancan con lo guardado.
 */

const nudo = {
  id: "n1",
  name: "a1",
  x: 1,
  y: 2,
  z: 3,
  forceX: 0,
  forceY: 0,
  forceZ: 0,
  displacementX: 0,
  displacementY: 0,
  displacementZ: 0,
  restrainedX: true,
  restrainedY: true,
  restrainedZ: true,
  dofNumberX: 0,
  dofNumberY: 0,
  dofNumberZ: 0,
};
const barra = { id: "e1", name: "b1", fromNodeId: "n1", toNodeId: "n1", area: 1, elasticity: 2 };
const modelo = { nodes: [nudo], elements: [barra], restrainedFirst: true, useDofNumbers: false };

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("/armaduras-3d — la guarda de forma", () => {
  it("acepta un modelo completo y descarta uno con un solo campo mal", () => {
    expect(isPersistedModel(modelo)).toBe(true);
    expect(isPersistedModel({ ...modelo, nodes: [{ ...nudo, y: "2" }] })).toBe(false);
    expect(isPersistedModel({ ...modelo, nodes: [{ ...nudo, restrainedY: 1 }] })).toBe(false);
    expect(isPersistedModel({ ...modelo, elements: [{ ...barra, area: null }] })).toBe(false);
  });

  it("no acepta un modelo de /armaduras-2d: le falta la y", () => {
    const { y, forceY, displacementY, restrainedY, dofNumberY, ...plano } = nudo;
    void [y, forceY, displacementY, restrainedY, dofNumberY];
    expect(isPersistedModel({ ...modelo, nodes: [plano] })).toBe(false);
  });
});

describe("/armaduras-3d — volver al ejemplo inicial", () => {
  it("devuelve lo que había, y restaurarlo lo deja igual", () => {
    const store = createStore();
    store.set(atomRestoreModel, modelo);
    const previo = store.set(atomResetModel);
    expect(store.get(atomNodes).map((n) => n.name)).toEqual(["a", "b", "c", "d"]);
    expect(store.get(atomElements)).toHaveLength(6);

    store.set(atomRestoreModel, previo);
    expect(store.get(atomPersistableModel)).toEqual(modelo);
  });
});

describe("/armaduras-3d — al arrancar", () => {
  it("los átomos toman lo guardado, no el ejemplo inicial", async () => {
    localStorage.setItem(MODEL_KEY, JSON.stringify({ v: MODEL_VERSION, data: modelo }));
    vi.resetModules();

    const { atomNodes: nodosFrescos } = await import("./nodes");
    const { atomElements: barrasFrescas } = await import("./elements");
    const { atomRestrainedFirst: ordenFresco } = await import("./dof-order");
    const store = createStore();

    expect(store.get(nodosFrescos).map((n) => n.name)).toEqual(["a1"]);
    expect(store.get(barrasFrescas).map((e) => e.name)).toEqual(["b1"]);
    expect(store.get(ordenFresco)).toBe(true);
  });

  it("con algo guardado que no se entiende, arranca con el ejemplo inicial y lo dice", async () => {
    localStorage.setItem(MODEL_KEY, JSON.stringify({ v: MODEL_VERSION + 1, data: modelo }));
    vi.resetModules();

    const { atomNodes: nodosFrescos } = await import("./nodes");
    const { storedModelDiscarded } = await import("./persisted-model");
    const store = createStore();

    expect(store.get(nodosFrescos).map((n) => n.name)).toEqual(["a", "b", "c", "d"]);
    expect(storedModelDiscarded).toBe(true);
  });

  it("no lee lo guardado de los otros sistemas: cada uno tiene su clave", () => {
    expect(MODEL_KEY).not.toBe("eder-estructuras:armaduras-2d");
    expect(MODEL_KEY).not.toBe("eder-estructuras:springs");
  });
});
