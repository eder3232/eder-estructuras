import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomClassification } from "./classification";
import { atomToggleRestrainedFirst, atomToggleUseDofNumbers } from "./dof-order";
import { atomAddElement, atomElements, atomRemoveElement, atomUpdateElementField } from "./elements";
import { atomAddNode, atomNodes, atomToggleNodeRestrained } from "./nodes";
import { atomResults } from "./results";

type Store = ReturnType<typeof createStore>;

function solved(store: Store) {
  const results = store.get(atomResults);
  if (results.status !== "ok") throw new Error(`se esperaba ok y dio ${results.status}`);
  return results;
}

/** Un resorte nuevo entre dos nudos, con la k heredada. */
function connect(store: Store, from: string, to: string) {
  store.set(atomAddElement);
  const added = store.get(atomElements).at(-1)!;
  store.set(atomUpdateElementField, { id: added.id, field: "fromNodeId", value: from });
  store.set(atomUpdateElementField, { id: added.id, field: "toNodeId", value: to });
}

describe("/springs — estado vacío (U3)", () => {
  it("sin resortes no es un error: todavía no hay nada que resolver", () => {
    const store = createStore();
    for (const element of store.get(atomElements)) store.set(atomRemoveElement, element.id);
    expect(store.get(atomResults)).toMatchObject({ status: "empty", reason: "no-elements", nodeCount: 5 });
  });
});

describe("/springs — advertencias (E2)", () => {
  it("un nudo restringido sin resortes avisa en el idioma de este sistema, y los resultados siguen", () => {
    // Restringido: un nudo **libre** sin resortes no es un aviso sino un
    // mecanismo —su fila de K es toda de ceros—, y eso lo cubre otro test.
    const store = createStore();
    store.set(atomAddNode);
    store.set(atomToggleNodeRestrained, store.get(atomNodes).at(-1)!.id);
    const results = solved(store);
    const [warning] = results.warnings;
    expect(warning).toMatchObject({ severity: "warning", refName: "v6" });
    expect(warning.message).toContain("ningún resorte conectado");
    expect(warning.message).not.toContain("barra");
  });
});

describe("/springs — orden de grados de libertad (M1a/M1b)", () => {
  it("con los restringidos arriba, la matriz empieza por v4 y v5 y los resultados no cambian", () => {
    const store = createStore();
    const before = solved(store).solved.displacements.get("seed-v1")![0];
    store.set(atomToggleRestrainedFirst);
    const after = solved(store).solved;
    expect(after.assembly.restrainedFirst).toBe(true);
    expect(after.assembly.dofOrder.slice(0, 2).every((d) => d.restrained)).toBe(true);
    expect(after.displacements.get("seed-v1")![0]).toBeCloseTo(before, 12);
  });

  it("al encender la numeración manual se siembra con el orden de la tabla", () => {
    const store = createStore();
    store.set(atomToggleUseDofNumbers);
    expect(store.get(atomNodes).map((n) => n.dofNumber)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("/springs — clasificación g = b + r − n", () => {
  it("el ejemplo inicial: 4 + 2 − 5 = 1, hiperestático, y la matriz lo confirma", () => {
    expect(createStore().get(atomClassification)).toMatchObject({
      springs: 4,
      reactions: 2,
      nodes: 5,
      count: { degree: 1 },
      verdict: "indeterminate",
    });
  });

  it("sin e1 queda una cadena colgada de v5: isostático", () => {
    const store = createStore();
    store.set(atomRemoveElement, "seed-e1");
    expect(store.get(atomClassification)).toMatchObject({ count: { degree: 0 }, verdict: "determinate" });
  });

  it("el conteo da hiperestático y es un mecanismo: v1, v2 y v3 quedaron sin ningún apoyo", () => {
    const store = createStore();
    store.set(atomRemoveElement, "seed-e1");
    store.set(atomRemoveElement, "seed-e3");
    // Dos resortes entre los apoyos: suman incógnitas, pero no sujetan al grupo.
    connect(store, "seed-v4", "seed-v5");
    connect(store, "seed-v4", "seed-v5");
    expect(store.get(atomClassification)).toMatchObject({ count: { degree: 1 }, verdict: "unstable-by-arrangement" });

    const results = store.get(atomResults);
    if (results.status !== "error") throw new Error(results.status);
    const mode = results.errors[0].mechanism!.mode!.filter((dof) => Math.abs(dof.value) > 1e-9);
    // Los tres se mueven juntos, la misma distancia.
    expect(mode.map((dof) => dof.nodeId).sort()).toEqual(["seed-v1", "seed-v2", "seed-v3"]);
    expect(new Set(mode.map((dof) => Math.abs(dof.value).toFixed(9))).size).toBe(1);
  });
});

describe("/springs — el signo de la fuerza depende de la orientación", () => {
  it("dar vuelta un resorte en la tabla le cambia el signo a F (lo que dice la sección 4)", () => {
    const store = createStore();
    const before = (solved(store).solved.internalForces.get("seed-e2") as { axialForce: number }).axialForce;
    store.set(atomUpdateElementField, { id: "seed-e2", field: "fromNodeId", value: "seed-v3" });
    store.set(atomUpdateElementField, { id: "seed-e2", field: "toNodeId", value: "seed-v2" });
    const after = (solved(store).solved.internalForces.get("seed-e2") as { axialForce: number }).axialForce;
    expect(after).toBeCloseTo(-before, 12);
  });
});
