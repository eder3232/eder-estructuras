import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { COLLAPSE_ABOVE_DOFS } from "@/components/custom/assembly-steps";
import { HEATMAP_ABOVE_DOFS } from "@/components/custom/global-equation";
import { atomClassification } from "./classification";
import { examples } from "./examples";
import { atomNodes, atomNodesBase, seedNodeIds } from "./nodes";
import { isPersistedModel, type PersistedModel } from "./persisted-model";
import { atomRestoreModel } from "./persistence";
import { atomResults } from "./results";

/**
 * N2 en `/armaduras-3d`. Un ejemplo que no muestra lo que dice mostrar es una
 * mentira en el menú, así que se afirma la lección de cada uno, la del
 * tetraedro inicial incluida.
 */

const byId = (id: string) => examples.find((e) => e.id === id)!;

function solve(model: PersistedModel) {
  const store = createStore();
  store.set(atomRestoreModel, model);
  return { store, results: store.get(atomResults) };
}

function axialForces(model: PersistedModel): Map<string, number> {
  const { results } = solve(model);
  if (results.status !== "ok") throw new Error(`no resolvió: ${results.status}`);
  return new Map(
    [...results.solved.internalForces].map(([id, f]) => [id, (f as { axialForce: number }).axialForce]),
  );
}

describe("ejemplos precargados de /armaduras-3d", () => {
  it("todos tienen la forma que se guarda", () => {
    for (const example of examples) expect(isPersistedModel(example.model), example.name).toBe(true);
  });

  it("los que deben resolver resuelven, cierran en equilibrio y no arrastran advertencias", () => {
    for (const example of examples.filter((e) => e.id !== "aplastado")) {
      const { results } = solve(example.model);
      if (results.status !== "ok") throw new Error(`${example.name}: ${results.status}`);
      expect(results.solved.equilibrium.ok, example.name).toBe(true);
      expect(results.warnings, example.name).toEqual([]);
    }
  });

  it("el trípode es isostático: los esfuerzos no dependen del material", () => {
    const tripode = byId("tripode");
    expect(solve(tripode.model).store.get(atomClassification)).toMatchObject({
      count: { degree: 0 },
      verdict: "determinate",
    });

    const rigido = {
      ...tripode.model,
      elements: tripode.model.elements.map((e) => ({ ...e, area: e.area * 3, elasticity: e.elasticity * 7 })),
    };
    const antes = axialForces(tripode.model);
    const despues = axialForces(rigido);
    for (const [id, n] of antes) expect(despues.get(id)).toBeCloseTo(n, 8);
    // Y las tres patas trabajan distinto: si no, no habría nada que mirar.
    expect(new Set([...antes.values()].map((n) => n.toFixed(2))).size).toBe(3);
  });

  it("el tetraedro aplastado: la cuenta dice hiperestático y la matriz dice mecanismo, con d suelto en z", () => {
    const { store, results } = solve(byId("aplastado").model);
    expect(store.get(atomClassification)).toMatchObject({
      count: { degree: 1 },
      verdict: "unstable-by-arrangement",
    });
    if (results.status !== "error") throw new Error(results.status);
    const mechanism = results.errors.find((e) => e.mechanism)?.mechanism;
    expect(mechanism?.loose).toEqual([{ nodeId: "apl-d", localDof: 2 }]);
  });

  it("la torre pasa los dos umbrales de matrices grandes", () => {
    const { store, results } = solve(byId("torre").model);
    if (results.status !== "ok") throw new Error(results.status);
    const dofs = results.solved.assembly.dofOrder.length;
    expect(dofs).toBe(27);
    expect(dofs).toBeGreaterThan(HEATMAP_ABOVE_DOFS);
    expect(dofs).toBeGreaterThan(COLLAPSE_ABOVE_DOFS);
    expect(store.get(atomClassification)).toMatchObject({ count: { degree: 1 }, verdict: "indeterminate" });
  });

  it("cargar un ejemplo dos veces da lo mismo: el store no queda apuntando a sus objetos", () => {
    const example = byId("tripode");
    const { store } = solve(example.model);
    store.set(atomNodesBase, store.get(atomNodes).map((n) => ({ ...n, forceZ: 0 })));
    store.set(atomRestoreModel, example.model);
    expect(example.model.nodes[3].forceZ).toBe(-30);
    expect(store.get(atomNodes)[3].forceZ).toBe(-30);
  });
});

describe("el tetraedro inicial", () => {
  it("es hiperestático de grado 1", () => {
    expect(createStore().get(atomClassification)).toMatchObject({ count: { degree: 1 }, verdict: "indeterminate" });
  });

  it("y aun así el apoyo que cede, solo, no tensiona ninguna barra", () => {
    // `b` baja 1 cm, y eso es compatible con un giro rígido alrededor de la
    // recta a–c. Lo que se le suponía a este ejemplo era lo contrario; el
    // test fija lo que de verdad pasa.
    const store = createStore();
    expect(store.get(atomNodes).find((n) => n.id === seedNodeIds.b)!.displacementZ).toBe(-0.01);
    store.set(atomNodesBase, store.get(atomNodes).map((n) => ({ ...n, forceZ: 0 })));

    const results = store.get(atomResults);
    if (results.status !== "ok") throw new Error(results.status);
    for (const f of results.solved.internalForces.values()) {
      expect((f as { axialForce: number }).axialForce).toBeCloseTo(0, 8);
    }
    // Pero el nudo libre sí se mueve: acompaña el giro.
    expect(Math.abs(results.solved.displacements.get(seedNodeIds.d)![2])).toBeGreaterThan(1e-4);
  });
});
