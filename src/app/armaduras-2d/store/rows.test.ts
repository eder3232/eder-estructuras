import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomAddElement, atomElements, atomRemoveElement } from "./elements";
import { atomAddNode, atomNodes, atomRemoveNode, seedNodeIds } from "./nodes";

/**
 * `nextRowName`/`insertIndex` ya están probados sueltos en `src/lib`. Lo que se
 * prueba acá es el cableado: que los átomos de alta pasen el `afterId` y no
 * terminen agregando siempre al final, que es el bug que tenían.
 */
describe("insertar filas en /armaduras-2d", () => {
  it("el nudo nuevo cae debajo del de referencia, no al final", () => {
    const store = createStore();
    store.set(atomAddNode, seedNodeIds.v1);

    const names = store.get(atomNodes).map((n) => n.name);
    expect(names).toEqual(["v1", "v5", "v2", "v3", "v4"]);
  });

  it("sin referencia agrega al final (botón del encabezado)", () => {
    const store = createStore();
    store.set(atomAddNode);

    expect(store.get(atomNodes).map((n) => n.name)).toEqual(["v1", "v2", "v3", "v4", "v5"]);
  });

  it("insertar después de borrar del medio no repite un nombre", () => {
    const store = createStore();
    store.set(atomRemoveNode, seedNodeIds.v2);
    store.set(atomAddNode, seedNodeIds.v1);

    const names = store.get(atomNodes).map((n) => n.name);
    expect(names).toEqual(["v1", "v2", "v3", "v4"]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("insertar un nudo no toca las barras que ya existen", () => {
    const store = createStore();
    const before = store.get(atomElements).map((e) => [e.fromNodeId, e.toNodeId]);
    store.set(atomAddNode, seedNodeIds.v1);

    expect(store.get(atomElements).map((e) => [e.fromNodeId, e.toNodeId])).toEqual(before);
  });

  it("la barra nueva cae debajo de la de referencia", () => {
    const store = createStore();
    store.set(atomAddElement, "seed-e2");

    expect(store.get(atomElements).map((e) => e.name)).toEqual(["e1", "e2", "e7", "e3", "e4", "e5", "e6"]);
  });

  it("borrar y volver a insertar una barra reusa el hueco de numeración", () => {
    const store = createStore();
    store.set(atomRemoveElement, "seed-e3");
    store.set(atomAddElement, "seed-e1");

    expect(store.get(atomElements).map((e) => e.name)).toEqual(["e1", "e3", "e2", "e4", "e5", "e6"]);
  });
});
