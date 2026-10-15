import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomAddElement, atomElements, atomRemoveElement, atomUpdateElementField } from "./elements";
import { atomAddNode, atomNodes, atomRemoveNode, atomUpdateNodeField, seedNodeIds } from "./nodes";
import { atomResults } from "./results";

/**
 * Cada bloque fija uno de los bugs de la revisión para la v1 (ver
 * `docs/armaduras-3d-v1.md`). La regresión numérica está en `results.test.ts`.
 */

function errorsOf(store: ReturnType<typeof createStore>) {
  const results = store.get(atomResults);
  if (results.status !== "error") throw new Error(`se esperaba un error y dio ${results.status}`);
  return results.errors;
}

describe("/armaduras-3d — B1: una barra nueva no nace en error", () => {
  it("hereda el área y la elasticidad de la fila de arriba", () => {
    const store = createStore();
    store.set(atomAddElement, "seed-e2");
    const added = store.get(atomElements)[2];
    expect(added).toMatchObject({ area: 0.002, elasticity: 2 * 10 ** 7 });
  });

  it("y conectada a dos nudos, el modelo resuelve", () => {
    const store = createStore();
    store.set(atomAddElement);
    const added = store.get(atomElements).at(-1)!;
    store.set(atomUpdateElementField, { id: added.id, field: "fromNodeId", value: seedNodeIds.a });
    store.set(atomUpdateElementField, { id: added.id, field: "toNodeId", value: seedNodeIds.c });
    expect(store.get(atomResults).status).toBe("ok");
  });
});

describe("/armaduras-3d — B2: los mensajes nombran filas, no ids internos", () => {
  it("un área inválida se dice con el nombre de la barra", () => {
    const store = createStore();
    store.set(atomUpdateElementField, { id: "seed-e1", field: "area", value: 0 });
    const [error] = errorsOf(store);
    expect(error).toMatchObject({ source: "element", refName: "e1" });
    expect(error.message).toBe("El elemento e1 debe tener área positiva.");
  });

  it("una barra de longitud cero se dice con los nombres de la barra y de los nudos", () => {
    const store = createStore();
    // `c` se mueve a donde está `b`: la barra e2 (b → c) queda de longitud cero.
    store.set(atomUpdateNodeField, { id: seedNodeIds.c, field: "y", value: 0 });
    store.set(atomUpdateNodeField, { id: seedNodeIds.c, field: "x", value: 3.5 });
    const [error] = errorsOf(store);
    expect(error.message).toBe("El elemento e2 tiene longitud cero: los nodos b y c coinciden.");
  });
});

describe("/armaduras-3d — B3: agregar filas no repite nombres", () => {
  it("aunque se haya borrado una fila del medio", () => {
    const store = createStore();
    store.set(atomRemoveElement, "seed-e1");
    store.set(atomAddElement);
    store.set(atomAddElement);
    const names = store.get(atomElements).map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);

    store.set(atomAddNode);
    store.set(atomAddNode);
    const nodeNames = store.get(atomNodes).map((n) => n.name);
    expect(new Set(nodeNames).size).toBe(nodeNames.length);
  });

  it("inserta debajo de la fila pedida", () => {
    const store = createStore();
    store.set(atomAddNode, seedNodeIds.a);
    expect(store.get(atomNodes)[1].name).toBe("v1");
  });
});

describe("/armaduras-3d — B4: sin barras no hay nada que resolver", () => {
  it("es el estado vacío, no un mecanismo", () => {
    const store = createStore();
    for (const element of store.get(atomElements)) store.set(atomRemoveElement, element.id);
    expect(store.get(atomResults)).toMatchObject({ status: "empty", reason: "no-elements", nodeCount: 4 });
  });

  it("sin nudos tampoco", () => {
    const store = createStore();
    for (const node of store.get(atomNodes)) store.set(atomRemoveNode, node.id);
    expect(store.get(atomResults)).toMatchObject({ status: "empty", reason: "no-nodes" });
  });
});
