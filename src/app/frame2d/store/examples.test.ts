import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomClassification } from "./classification";
import { atomElements, atomElementsBase, atomUpdateElementField } from "./elements";
import { examples } from "./examples";
import { isPersistedModel, type PersistedModel } from "./persisted-model";
import { atomRestoreModel } from "./persistence";
import { atomMemberDiagrams, atomResults } from "./results";

/**
 * N2 en `/frame2d`. Un ejemplo que no muestra lo que dice mostrar es una
 * mentira en el menú, así que se afirma la lección de cada uno.
 */

const byId = (id: string) => examples.find((e) => e.id === id)!;

function load(model: PersistedModel) {
  const store = createStore();
  store.set(atomRestoreModel, model);
  return store;
}

function solvedOf(store: ReturnType<typeof createStore>) {
  const results = store.get(atomResults);
  if (results.status !== "ok") throw new Error(`no resolvió: ${results.status}`);
  return results.solved;
}

/** M (convención de viga) en un extremo de una barra: x = 0 o x = L. */
function momentAt(store: ReturnType<typeof createStore>, elementId: string, end: "from" | "to") {
  const result = store.get(atomMemberDiagrams).get(elementId);
  if (result?.status !== "ok") throw new Error("sin diagrama");
  const points = result.diagram.points;
  return end === "from" ? points[0].M : points[points.length - 1].M;
}

describe("ejemplos precargados de /frame2d", () => {
  it("todos tienen la forma que se guarda", () => {
    for (const example of examples) expect(isPersistedModel(example.model), example.id).toBe(true);
  });

  it("todos resuelven, cierran en equilibrio, sin advertencias, y con diagramas que cierran", () => {
    for (const example of examples) {
      const store = load(example.model);
      const results = store.get(atomResults);
      if (results.status !== "ok") throw new Error(`${example.id}: ${results.status}`);
      expect(results.solved.equilibrium.ok, example.id).toBe(true);
      expect(results.warnings, example.id).toEqual([]);
      for (const result of store.get(atomMemberDiagrams).values()) {
        if (result.status !== "ok") throw new Error("sin diagrama");
        expect(Math.abs(result.diagram.closure.M), example.id).toBeLessThan(1e-6);
      }
    }
  });

  it("viga continua: −qL²/8 sobre el apoyo del medio, 3qL/8 y 10qL/8 de reacciones", () => {
    const store = load(byId("viga-continua").model);
    const solved = solvedOf(store);
    // q = 10, L = 5.
    expect(momentAt(store, "vc-e1", "to")).toBeCloseTo(-31.25, 6);
    expect(momentAt(store, "vc-e2", "from")).toBeCloseTo(-31.25, 6);
    expect(solved.reactions.get("vc-a")![1]).toBeCloseTo(18.75, 6);
    expect(solved.reactions.get("vc-b")![1]).toBeCloseTo(62.5, 6);
    expect(solved.reactions.get("vc-c")![1]).toBeCloseTo(18.75, 6);
    // El momento cambia de signo dos veces: positivo en cada tramo, negativo sobre b.
    for (const id of ["vc-e1", "vc-e2"]) {
      const result = store.get(atomMemberDiagrams).get(id);
      if (result?.status !== "ok") throw new Error("sin diagrama");
      expect(Math.max(...result.diagram.points.map((p) => p.M)), id).toBeGreaterThan(0);
    }
    const classification = store.get(atomClassification);
    if (classification.status !== "counted") throw new Error(classification.status);
    expect(classification.count.degree).toBe(1);
  });

  it("dos aguas: la carga total es q por la luz en planta, no por el largo de las vigas", () => {
    const store = load(byId("dos-aguas").model);
    const solved = solvedOf(store);
    const vertical = solved.reactions.get("da-a")![1] + solved.reactions.get("da-e")![1];
    expect(vertical).toBeCloseTo(8 * 10, 6);
    // Y las vigas inclinadas trabajan a compresión.
    const diagrams = store.get(atomMemberDiagrams);
    for (const id of ["da-e2", "da-e3"]) {
      const result = diagrams.get(id);
      if (result?.status !== "ok") throw new Error("sin diagrama");
      expect(result.diagram.points.every((p) => p.N < 0), id).toBe(true);
    }
  });

  it("isostático: g = 0, y cambiar la inercia de la viga no mueve los momentos (sí la deformada)", () => {
    const store = load(byId("isostatico").model);
    const classification = store.get(atomClassification);
    if (classification.status !== "counted") throw new Error(classification.status);
    expect(classification.count.degree).toBe(0);

    const before = momentAt(store, "is-e2", "from");
    const displacementBefore = solvedOf(store).displacements.get("is-c")![0];
    const beam = store.get(atomElements).find((e) => e.id === "is-e2")!;
    store.set(atomUpdateElementField, { id: beam.id, field: "inertia", value: beam.inertia * 5 });

    expect(momentAt(store, "is-e2", "from")).toBeCloseTo(before, 9);
    expect(Math.abs(before)).toBeGreaterThan(1);
    expect(solvedOf(store).displacements.get("is-c")![0]).not.toBeCloseTo(displacementBefore, 6);
  });

  it("cargar un ejemplo dos veces da lo mismo: el store no queda apuntando a sus objetos", () => {
    const example = byId("viga-continua");
    const store = load(example.model);
    store.set(atomUpdateElementField, { id: "vc-e1", field: "inertia", value: 99 });
    expect(example.model.elements[0].inertia).not.toBe(99);
    store.set(atomRestoreModel, example.model);
    expect(store.get(atomElementsBase)[0].inertia).toBe(example.model.elements[0].inertia);
  });
});
