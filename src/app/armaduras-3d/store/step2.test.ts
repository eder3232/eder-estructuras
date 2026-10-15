import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomClassification } from "./classification";
import { atomToggleRestrainedFirst, atomToggleUseDofNumbers } from "./dof-order";
import { atomAddNode, atomNodes, atomToggleNodeRestrained, atomUpdateNodeField, seedNodeIds } from "./nodes";
import { atomResults } from "./results";

/** El paso 2 de docs/armaduras-3d-v1.md: lo que `/armaduras-2d` tenía y 3D no. */

function solvedOf(store: ReturnType<typeof createStore>) {
  const results = store.get(atomResults);
  if (results.status !== "ok") throw new Error(`se esperaba ok y dio ${results.status}`);
  return results;
}

describe("/armaduras-3d — clasificación g = b + r − 3n", () => {
  it("el tetraedro inicial es hiperestático de grado 1: 6 + 7 − 12", () => {
    const classification = createStore().get(atomClassification);
    expect(classification).toMatchObject({
      status: "counted",
      bars: 6,
      reactions: 7,
      nodes: 4,
      count: { degree: 1 },
      verdict: "indeterminate",
    });
  });

  it("aplastado, el conteo no cambia y la matriz dice mecanismo: la lección del 3D", () => {
    // `d` baja al plano de los otros tres: todas sus barras quedan en z = 0 y
    // ninguna lo frena en z. La cuenta da lo mismo, porque no mira geometría.
    const store = createStore();
    store.set(atomUpdateNodeField, { id: seedNodeIds.d, field: "z", value: 0 });

    expect(store.get(atomClassification)).toMatchObject({ count: { degree: 1 }, verdict: "unstable-by-arrangement" });

    const results = store.get(atomResults);
    if (results.status !== "error") throw new Error(results.status);
    const mechanism = results.errors.find((e) => e.mechanism)?.mechanism;
    expect(mechanism?.loose).toEqual([{ nodeId: seedNodeIds.d, localDof: 2 }]);
  });
});

describe("/armaduras-3d — orden de los grados de libertad (M1a, M1b)", () => {
  it("con los restringidos arriba, los 7 restringidos son los primeros 7", () => {
    const store = createStore();
    store.set(atomToggleRestrainedFirst);
    const { dofOrder } = solvedOf(store).solved.assembly;
    const restrainedIndices = dofOrder.filter((e) => e.restrained).map((e) => e.globalIndex);
    expect(restrainedIndices.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("al encender la numeración manual se siembra con el orden de la tabla, de a tres por nudo", () => {
    const store = createStore();
    store.set(atomToggleUseDofNumbers);
    const d = store.get(atomNodes).find((n) => n.id === seedNodeIds.d)!;
    expect([d.dofNumberX, d.dofNumberY, d.dofNumberZ]).toEqual([10, 11, 12]);
  });

  it("la numeración del alumno manda, y los resultados no cambian", () => {
    const before = solvedOf(createStore()).solved.displacements.get(seedNodeIds.d)!;

    const store = createStore();
    store.set(atomToggleUseDofNumbers);
    // Se le da a `d` los tres primeros números y a `a` los últimos.
    store.set(atomUpdateNodeField, { id: seedNodeIds.d, field: "dofNumberX", value: 1 });
    store.set(atomUpdateNodeField, { id: seedNodeIds.d, field: "dofNumberY", value: 2 });
    store.set(atomUpdateNodeField, { id: seedNodeIds.d, field: "dofNumberZ", value: 3 });
    store.set(atomUpdateNodeField, { id: seedNodeIds.a, field: "dofNumberX", value: 10 });
    store.set(atomUpdateNodeField, { id: seedNodeIds.a, field: "dofNumberY", value: 11 });
    store.set(atomUpdateNodeField, { id: seedNodeIds.a, field: "dofNumberZ", value: 12 });

    const { solved } = solvedOf(store);
    const first = solved.assembly.dofOrder.find((e) => e.globalIndex === 0)!;
    expect(first).toMatchObject({ nodeId: seedNodeIds.d, localDof: 0 });
    solved.displacements.get(seedNodeIds.d)!.forEach((u, i) => expect(u).toBeCloseTo(before[i], 12));
  });
});

describe("/armaduras-3d — advertencias (E2)", () => {
  it("un nudo apoyado sin barras resuelve igual, y avisa nombrándolo", () => {
    const store = createStore();
    store.set(atomAddNode);
    const added = store.get(atomNodes).at(-1)!;
    for (const axis of ["x", "y", "z"] as const) store.set(atomToggleNodeRestrained, { id: added.id, axis });

    const { warnings } = solvedOf(store);
    expect(warnings).toEqual([expect.objectContaining({ severity: "warning", refName: "v1" })]);
  });
});
