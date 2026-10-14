import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomAddElement, atomElements, atomRemoveElement, atomUpdateElementField } from "./elements";
import { atomAddNode, atomNodes, atomRemoveNode } from "./nodes";
import { atomResults } from "./results";

/**
 * Los primeros tests de `/springs`, que hasta la revisión del 2026-10-14 no
 * tenía ninguno propio. Cada bloque fija uno de los bugs de esa revisión (ver
 * `docs/springs-v1.md`).
 */

function errorsOf(store: ReturnType<typeof createStore>) {
  const results = store.get(atomResults);
  if (results.status !== "error") throw new Error(`se esperaba un error y dio ${results.status}`);
  return results.errors;
}

describe("/springs — el ejemplo inicial", () => {
  it("resuelve con los valores del original (regresión de thesis-structures)", () => {
    const results = createStore().get(atomResults);
    if (results.status !== "ok") throw new Error(results.status);
    expect(results.solved.displacements.get("seed-v1")![0]).toBeCloseTo(1.393293, 5);
    expect(results.solved.reactions.get("seed-v4")![0]).toBeCloseTo(-7.682927, 5);
  });
});

describe("/springs — B1: la rigidez tiene que ser positiva", () => {
  it.each([0, -10])("k = %s es un error de ese resorte, nombrado por su nombre", (k) => {
    const store = createStore();
    store.set(atomUpdateElementField, { id: "seed-e1", field: "k", value: k });
    const [error] = errorsOf(store);
    expect(error).toMatchObject({ source: "element", refName: "e1" });
    expect(error.message).toBe("El elemento e1 debe tener rigidez k positiva.");
  });
});

describe("/springs — B2: los mensajes nombran filas, no ids internos", () => {
  it("borrar un nudo que usa un resorte lo dice con los nombres que se ven", () => {
    const store = createStore();
    store.set(atomRemoveNode, "seed-v1");
    const [error] = errorsOf(store);
    expect(error).toMatchObject({ refName: "e4", message: "El elemento e4 referencia un nudo inexistente." });
    expect(error.message).not.toContain("seed-");
  });
});

describe("/springs — B3 y D7: agregar filas", () => {
  it("no repite nombres aunque se haya borrado una fila del medio", () => {
    const store = createStore();
    store.set(atomRemoveNode, "seed-v4");
    store.set(atomAddNode);
    const names = store.get(atomNodes).map((n) => n.name);
    expect(new Set(names).size).toBe(names.length);

    store.set(atomRemoveElement, "seed-e1");
    store.set(atomAddElement);
    const elementNames = store.get(atomElements).map((e) => e.name);
    expect(new Set(elementNames).size).toBe(elementNames.length);
  });

  it("inserta debajo de la fila pedida, y no al final", () => {
    const store = createStore();
    store.set(atomAddNode, "seed-v4");
    expect(store.get(atomNodes)[1].name).not.toBe("v5");
    expect(store.get(atomNodes)).toHaveLength(6);
  });

  it("un resorte nuevo hereda la k de la fila de arriba, así no nace en un error", () => {
    const store = createStore();
    store.set(atomAddElement, "seed-e2");
    expect(store.get(atomElements)[2].k).toBe(4);
  });
});
