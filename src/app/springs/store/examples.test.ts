import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomClassification } from "./classification";
import { examples } from "./examples";
import { isPersistedModel } from "./persisted-model";
import { atomRestoreModel } from "./persistence";
import { atomResults } from "./results";

/**
 * Un ejemplo que no resuelve es peor que no tenerlo, y uno que no muestra lo
 * que dice mostrar es una mentira en el menú. Se afirman las dos cosas.
 */

function load(name: string) {
  const example = examples.find((e) => e.name === name)!;
  const store = createStore();
  store.set(atomRestoreModel, example.model);
  const results = store.get(atomResults);
  if (results.status !== "ok") throw new Error(`${name}: ${results.status}`);
  const force = (id: string) => (results.solved.internalForces.get(id) as { axialForce: number }).axialForce;
  return { store, solved: results.solved, force };
}

describe("ejemplos precargados de /springs", () => {
  it("los tres tienen la forma que se guarda, resuelven y cierran en equilibrio", () => {
    for (const example of examples) {
      expect(isPersistedModel(example.model), example.name).toBe(true);
      const store = createStore();
      store.set(atomRestoreModel, example.model);
      const results = store.get(atomResults);
      expect(results.status, example.name).toBe("ok");
      if (results.status === "ok") expect(results.solved.equilibrium.ok, example.name).toBe(true);
    }
  });

  it("en serie: isostático, la misma fuerza en los dos, desplazamientos que se suman", () => {
    const { store, solved, force } = load("Resortes en serie");
    expect(store.get(atomClassification)).toMatchObject({ count: { degree: 0 }, verdict: "determinate" });
    expect(force("ser-e1")).toBeCloseTo(10, 10);
    expect(force("ser-e2")).toBeCloseTo(10, 10);
    expect(solved.displacements.get("ser-v2")![0]).toBeCloseTo(1, 10);
    expect(solved.displacements.get("ser-v3")![0]).toBeCloseTo(3, 10);
  });

  it("en paralelo: hiperestático, la carga se reparte en proporción a k", () => {
    const { store, force } = load("Resortes en paralelo");
    expect(store.get(atomClassification)).toMatchObject({ count: { degree: 1 }, verdict: "indeterminate" });
    expect(force("par-e1")).toBeCloseTo(2, 10);
    expect(force("par-e2")).toBeCloseTo(6, 10);
  });

  it("apoyo que cede: sin cargas, y los resortes trabajan igual", () => {
    const { store, solved, force } = load("Apoyo que cede");
    expect(store.get(atomClassification)).toMatchObject({ count: { degree: 1 }, verdict: "indeterminate" });
    expect(solved.displacements.get("set-v2")![0]).toBeCloseTo(0.25, 10);
    expect(force("set-e1")).toBeCloseTo(2.5, 10);
    expect(force("set-e2")).toBeCloseTo(2.5, 10);
  });

  it("cargar un ejemplo dos veces da lo mismo: el store no queda apuntando a sus objetos", () => {
    const { store } = load("Resortes en serie");
    const example = examples[0];
    store.set(atomRestoreModel, example.model);
    expect(store.get(atomResults).status).toBe("ok");
    expect(example.model.nodes[2].force).toBe(10);
  });
});
