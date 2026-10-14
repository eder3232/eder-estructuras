// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";

import { atomNodes } from "./nodes";
import { atomPersistableModel, atomResetModel, atomRestoreModel } from "./persistence";
import { MODEL_KEY, MODEL_VERSION, isPersistedModel } from "./persisted-model";

/**
 * N1 en `/springs`, con la misma técnica que `/armaduras-2d`: la guarda de
 * forma, el reset con vuelta atrás, y —recargando el módulo— que los átomos
 * arrancan con lo guardado.
 */

const nudo = { id: "n1", name: "a1", force: 0, displacement: 0, restrained: true, dofNumber: 0 };
const resorte = { id: "e1", name: "r1", fromNodeId: "n1", toNodeId: "n1", k: 3 };
const modelo = { nodes: [nudo], elements: [resorte], restrainedFirst: true, useDofNumbers: false };

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("/springs — la guarda de forma", () => {
  it("acepta un modelo completo y descarta uno con un solo campo mal", () => {
    expect(isPersistedModel(modelo)).toBe(true);
    expect(isPersistedModel({ ...modelo, elements: [{ ...resorte, k: "3" }] })).toBe(false);
    expect(isPersistedModel({ ...modelo, nodes: [{ ...nudo, dofNumber: undefined }] })).toBe(false);
  });

  it("no acepta un modelo de armaduras: cada sistema tiene su forma", () => {
    const armadura = { ...modelo, nodes: [{ id: "n1", name: "v1", x: 0, z: 0 }] };
    expect(isPersistedModel(armadura)).toBe(false);
  });
});

describe("/springs — volver al ejemplo inicial", () => {
  it("devuelve lo que había, y restaurarlo lo deja igual", () => {
    const store = createStore();
    store.set(atomRestoreModel, modelo);
    const previo = store.set(atomResetModel);
    expect(store.get(atomNodes).map((n) => n.name)).toEqual(["v4", "v5", "v1", "v2", "v3"]);

    store.set(atomRestoreModel, previo);
    expect(store.get(atomPersistableModel)).toEqual(modelo);
  });
});

describe("/springs — al arrancar", () => {
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

    expect(store.get(nodosFrescos).map((n) => n.name)).toEqual(["v4", "v5", "v1", "v2", "v3"]);
    expect(storedModelDiscarded).toBe(true);
  });

  it("no lee lo guardado de /armaduras-2d: cada sistema tiene su clave", () => {
    expect(MODEL_KEY).not.toBe("eder-estructuras:armaduras-2d");
  });
});
