import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomAddElement, atomElements, atomRemoveElement, atomUpdateElementField } from "./elements";
import { atomAddNode, atomNodes, atomRemoveNode, atomToggleNodeRestrained, atomUpdateNodeField, seedNodeIds } from "./nodes";
import { atomResults } from "./results";

/**
 * Cada bloque fija uno de los bugs de la revisión para la v1 (ver
 * `docs/frame2d-v1.md`). La regresión numérica del pórtico semilla está en
 * `src/lib/engine/frame2d/system.test.ts`.
 */

function errorsOf(store: ReturnType<typeof createStore>) {
  const results = store.get(atomResults);
  if (results.status !== "error") throw new Error(`se esperaba un error y dio ${results.status}`);
  return results.errors;
}

function solvedOf(store: ReturnType<typeof createStore>) {
  const results = store.get(atomResults);
  if (results.status !== "ok") throw new Error(`se esperaba un resultado y dio ${results.status}`);
  return results.solved;
}

describe("/frame2d — B1: una barra nueva no nace en error", () => {
  it("hereda área, inercia y elasticidad de la fila de arriba, y no los FEM", () => {
    const store = createStore();
    store.set(atomUpdateElementField, { id: "seed-e2", field: "femMomentFrom", value: 7 });
    store.set(atomAddElement, "seed-e2");
    const [, beam, added] = store.get(atomElements);
    expect(added).toMatchObject({ area: beam.area, inertia: beam.inertia, elasticity: beam.elasticity });
    expect(added.femMomentFrom).toBe(0);
  });

  it("y conectada a dos nudos, el modelo resuelve", () => {
    const store = createStore();
    store.set(atomAddElement);
    const added = store.get(atomElements).at(-1)!;
    store.set(atomUpdateElementField, { id: added.id, field: "fromNodeId", value: seedNodeIds.v1 });
    store.set(atomUpdateElementField, { id: added.id, field: "toNodeId", value: seedNodeIds.v3 });
    expect(store.get(atomResults).status).toBe("ok");
  });

  it("con `afterId` se inserta debajo de esa fila", () => {
    const store = createStore();
    store.set(atomAddElement, "seed-e1");
    expect(store.get(atomElements).map((e) => e.name)).toEqual(["e1", "e4", "e2", "e3"]);
  });
});

describe("/frame2d — B2: los mensajes nombran filas, no ids internos", () => {
  it("una inercia inválida se dice con el nombre de la barra", () => {
    const store = createStore();
    store.set(atomUpdateElementField, { id: "seed-e2", field: "inertia", value: 0 });
    const [error] = errorsOf(store);
    expect(error).toMatchObject({ source: "element", refName: "e2" });
    expect(error.message).toBe("El elemento e2 debe tener momento de inercia positivo.");
  });

  it("una barra de longitud cero se dice con los nombres de la barra y de los nudos", () => {
    const store = createStore();
    // v3 se mueve a donde está v2: la viga e2 (v2 → v3) queda de longitud cero.
    store.set(atomUpdateNodeField, { id: seedNodeIds.v3, field: "x", value: 0 });
    const [error] = errorsOf(store);
    expect(error.message).toBe("El elemento e2 tiene longitud cero: los nodos v2 y v3 coinciden.");
  });
});

describe("/frame2d — B3: agregar filas no repite nombres", () => {
  it("en las barras, aunque se haya borrado una del medio", () => {
    const store = createStore();
    store.set(atomRemoveElement, "seed-e1");
    store.set(atomAddElement);
    store.set(atomAddElement);
    expect(store.get(atomElements).map((e) => e.name)).toEqual(["e2", "e3", "e1", "e4"]);
  });

  it("en los nudos", () => {
    const store = createStore();
    store.set(atomRemoveNode, seedNodeIds.v1);
    store.set(atomAddNode);
    store.set(atomAddNode);
    expect(store.get(atomNodes).map((n) => n.name)).toEqual(["v2", "v3", "v4", "v1", "v5"]);
  });
});

describe("/frame2d — B4: sin modelo no hay resultados, y no un mecanismo", () => {
  it("sin barras: vacío, no mecanismo", () => {
    const store = createStore();
    for (const id of ["seed-e1", "seed-e2", "seed-e3"]) store.set(atomRemoveElement, id);
    expect(store.get(atomResults)).toMatchObject({ status: "empty", reason: "no-elements", nodeCount: 4 });
  });

  it("sin nudos: vacío, no un «resuelto» sin nada adentro", () => {
    const store = createStore();
    for (const id of Object.values(seedNodeIds)) store.set(atomRemoveNode, id);
    for (const id of ["seed-e1", "seed-e2", "seed-e3"]) store.set(atomRemoveElement, id);
    expect(store.get(atomResults)).toMatchObject({ status: "empty", reason: "no-nodes" });
  });

  it("un mecanismo de verdad llega con su diagnóstico", () => {
    const store = createStore();
    // Sin restricción horizontal en ninguna base: el pórtico entero se desliza.
    store.set(atomToggleNodeRestrained, { id: seedNodeIds.v1, axis: "x" });
    store.set(atomToggleNodeRestrained, { id: seedNodeIds.v4, axis: "x" });
    const [error] = errorsOf(store);
    expect(error.mechanism).toBeDefined();
  });
});

describe("/frame2d — B6: la convención de los FEM a mano", () => {
  /**
   * El FEM es lo que la barra desarrolla con los extremos empotrados —la
   * reacción del empotramiento—, en ejes locales, con el momento antihorario
   * positivo. Para q = 10 hacia abajo sobre la viga de 5 m: V = qL/2 = 25 en
   * cada extremo y M = ±qL²/12. Cargado así, las reacciones verticales tienen
   * que sumar qL = 50 hacia arriba, y el extremo i de la viga queda con
   * momento antihorario sobre la barra (la viga cuelga entre las columnas).
   */
  it("una carga hacia abajo da reacciones hacia arriba", () => {
    const store = createStore();
    store.set(atomUpdateNodeField, { id: seedNodeIds.v3, field: "forceX", value: 0 });
    const fem = [
      ["femShearFrom", 25],
      ["femMomentFrom", 250 / 12],
      ["femShearTo", 25],
      ["femMomentTo", -250 / 12],
    ] as const;
    for (const [field, value] of fem) store.set(atomUpdateElementField, { id: "seed-e2", field, value });

    const solved = solvedOf(store);
    const [, rz1] = solved.reactions.get(seedNodeIds.v1)!;
    const [, rz4] = solved.reactions.get(seedNodeIds.v4)!;
    expect(rz1).toBeCloseTo(25, 6);
    expect(rz4).toBeCloseTo(25, 6);
    expect(solved.internalForces.get("seed-e2")).toMatchObject({ from: { shear: expect.closeTo(25, 6) } });
    expect((solved.internalForces.get("seed-e2") as { from: { moment: number } }).from.moment).toBeGreaterThan(0);
  });
});
