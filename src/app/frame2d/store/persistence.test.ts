// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "jotai";

import { atomElements } from "./elements";
import { atomLoads } from "./loads";
import { atomNodes } from "./nodes";
import { atomPersistableModel, atomResetModel, atomRestoreModel } from "./persistence";
import { MODEL_KEY, MODEL_VERSION, isPersistedModel } from "./persisted-model";

/**
 * N1 en `/frame2d`, con la técnica de los otros sistemas: la guarda de forma,
 * el reset con vuelta atrás, y —recargando el módulo— que los átomos arrancan
 * con lo guardado. Lo propio: las cargas en barras son parte del modelo.
 */

const nudo = {
  id: "n1",
  name: "a1",
  x: 1,
  z: 2,
  forceX: 0,
  forceZ: 0,
  momentR: 0,
  displacementX: 0,
  displacementZ: 0,
  displacementR: 0,
  restrainedX: true,
  restrainedZ: true,
  restrainedR: true,
  dofNumberX: 0,
  dofNumberZ: 0,
  dofNumberR: 0,
};
const barra = {
  id: "e1",
  name: "b1",
  fromNodeId: "n1",
  toNodeId: "n1",
  area: 1,
  elasticity: 2,
  inertia: 3,
  manualFem: false,
  femAxialFrom: 0,
  femShearFrom: 0,
  femMomentFrom: 0,
  femAxialTo: 0,
  femShearTo: 0,
  femMomentTo: 0,
};
const carga = {
  id: "c1",
  name: "k1",
  elementId: "e1",
  kind: "distributed" as const,
  direction: "globalZ" as const,
  q1: -5,
  q2: -5,
  wholeBar: true,
  a: 0,
  b: 0,
  projected: false,
};
const modelo = { nodes: [nudo], elements: [barra], loads: [carga], restrainedFirst: true, useDofNumbers: false };

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("/frame2d — la guarda de forma", () => {
  it("acepta un modelo completo y descarta uno con un solo campo mal", () => {
    expect(isPersistedModel(modelo)).toBe(true);
    expect(isPersistedModel({ ...modelo, nodes: [{ ...nudo, momentR: "0" }] })).toBe(false);
    expect(isPersistedModel({ ...modelo, elements: [{ ...barra, inertia: null }] })).toBe(false);
    expect(isPersistedModel({ ...modelo, elements: [{ ...barra, manualFem: 0 }] })).toBe(false);
    expect(isPersistedModel({ ...modelo, loads: [{ ...carga, kind: "triangular" }] })).toBe(false);
    expect(isPersistedModel({ ...modelo, loads: [{ ...carga, direction: "y" }] })).toBe(false);
  });

  it("no acepta un modelo sin cargas, ni uno de /armaduras-2d", () => {
    const { loads, ...sinCargas } = modelo;
    void loads;
    expect(isPersistedModel(sinCargas)).toBe(false);
    const { momentR, displacementR, restrainedR, dofNumberR, ...plano } = nudo;
    void [momentR, displacementR, restrainedR, dofNumberR];
    expect(isPersistedModel({ ...modelo, nodes: [plano] })).toBe(false);
  });
});

describe("/frame2d — volver al ejemplo inicial", () => {
  it("devuelve lo que había, y restaurarlo lo deja igual (cargas incluidas)", () => {
    const store = createStore();
    store.set(atomRestoreModel, modelo);
    const previo = store.set(atomResetModel);
    expect(store.get(atomNodes).map((n) => n.name)).toEqual(["v1", "v2", "v3", "v4"]);
    expect(store.get(atomElements)).toHaveLength(3);
    expect(store.get(atomLoads)).toEqual([]);

    store.set(atomRestoreModel, previo);
    expect(store.get(atomPersistableModel)).toEqual(modelo);
  });
});

describe("/frame2d — al arrancar", () => {
  it("los átomos toman lo guardado, no el ejemplo inicial", async () => {
    localStorage.setItem(MODEL_KEY, JSON.stringify({ v: MODEL_VERSION, data: modelo }));
    vi.resetModules();

    const { atomNodes: nodosFrescos } = await import("./nodes");
    const { atomElements: barrasFrescas } = await import("./elements");
    const { atomLoads: cargasFrescas } = await import("./loads");
    const { atomRestrainedFirst: ordenFresco } = await import("./dof-order");
    const store = createStore();

    expect(store.get(nodosFrescos).map((n) => n.name)).toEqual(["a1"]);
    expect(store.get(barrasFrescas).map((e) => e.name)).toEqual(["b1"]);
    expect(store.get(cargasFrescas).map((c) => c.name)).toEqual(["k1"]);
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

  it("no lee lo guardado de los otros sistemas: cada uno tiene su clave", () => {
    for (const other of ["armaduras-2d", "armaduras-3d", "springs"]) {
      expect(MODEL_KEY).not.toBe(`eder-estructuras:${other}`);
    }
  });
});
