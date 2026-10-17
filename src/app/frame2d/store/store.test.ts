import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { add, inv, multiply, subtract } from "mathjs";
import { loadCompatibility } from "@/lib/engine";

import { atomClassification } from "./classification";
import { atomToggleRestrainedFirst, atomToggleUseDofNumbers } from "./dof-order";
import {
  atomAddElement,
  atomElements,
  atomRemoveElement,
  atomSetAllElementsNumber,
  atomUpdateElementField,
} from "./elements";
import { atomAddNode, atomNodes, atomRemoveNode, atomToggleNodeRestrained, atomUpdateNodeField, seedNodeIds } from "./nodes";
import { atomAddLoad, atomLoads, atomUpdateLoadField } from "./loads";
import { atomMemberDiagrams, atomMemberLoads, atomMemberShapes, atomResults } from "./results";

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
    store.set(atomUpdateElementField, { id: "seed-e2", field: "manualFem", value: true });
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

describe("/frame2d — cargas en barras (paso 3)", () => {
  /** Saca la carga nodal de la semilla y pone q = −10 vertical en toda la viga e2. */
  function withBeamLoad() {
    const store = createStore();
    store.set(atomUpdateNodeField, { id: seedNodeIds.v3, field: "forceX", value: 0 });
    store.set(atomAddLoad, { elementId: "seed-e2" });
    const load = store.get(atomLoads)[0];
    store.set(atomUpdateLoadField, { id: load.id, field: "q1", value: -10 });
    store.set(atomUpdateLoadField, { id: load.id, field: "q2", value: -10 });
    return { store, load };
  }

  it("una carga vertical en toda la viga da el FEM de la tabla y las reacciones que suman qL", () => {
    const { store } = withBeamLoad();
    const fem = store.get(atomMemberLoads).fem.get("seed-e2")!;
    expect(fem.from.shear).toBeCloseTo(25, 9);
    expect(fem.from.moment).toBeCloseTo(250 / 12, 9);
    expect(fem.to.moment).toBeCloseTo(-250 / 12, 9);

    const solved = solvedOf(store);
    expect(solved.reactions.get(seedNodeIds.v1)![1] + solved.reactions.get(seedNodeIds.v4)![1]).toBeCloseTo(50, 9);
  });

  it("y da lo mismo que escribir ese FEM a mano (el test de B6)", () => {
    const { store } = withBeamLoad();
    const fromLoads = solvedOf(store).internalForces.get("seed-e2");

    const manual = createStore();
    manual.set(atomUpdateNodeField, { id: seedNodeIds.v3, field: "forceX", value: 0 });
    manual.set(atomUpdateElementField, { id: "seed-e2", field: "manualFem", value: true });
    for (const [field, value] of [
      ["femShearFrom", 25],
      ["femMomentFrom", 250 / 12],
      ["femShearTo", 25],
      ["femMomentTo", -250 / 12],
    ] as const) {
      manual.set(atomUpdateElementField, { id: "seed-e2", field, value });
    }
    // Gauss y la fórmula cerrada difieren en el último dígito: se compara con tolerancia.
    const fromManual = solvedOf(manual).internalForces.get("seed-e2") as typeof fromLoads & {
      from: Record<string, number>;
      to: Record<string, number>;
    };
    const expected = fromLoads as typeof fromManual;
    for (const end of ["from", "to"] as const) {
      for (const key of ["axial", "shear", "moment"]) {
        expect(fromManual[end][key]).toBeCloseTo(expected[end][key], 9);
      }
    }
  });

  it("mover un nudo recalcula el FEM: no queda congelado (V3 del original)", () => {
    const { store } = withBeamLoad();
    store.set(atomUpdateNodeField, { id: seedNodeIds.v3, field: "x", value: 6 });
    expect(store.get(atomMemberLoads).fem.get("seed-e2")!.from.shear).toBeCloseTo(30, 9);
  });

  it("una carga nueva copia la de arriba, con nombre propio", () => {
    const { store } = withBeamLoad();
    store.set(atomAddLoad);
    const [first, second] = store.get(atomLoads);
    expect(second).toMatchObject({ name: "c2", elementId: "seed-e2", q1: -10, kind: "distributed" });
    expect(second.id).not.toBe(first.id);
  });

  it("una posición fuera de la barra frena el cálculo, nombrando la carga", () => {
    const { store, load } = withBeamLoad();
    store.set(atomUpdateLoadField, { id: load.id, field: "kind", value: "point" });
    store.set(atomUpdateLoadField, { id: load.id, field: "a", value: 6 });
    const [error] = errorsOf(store);
    expect(error).toMatchObject({ source: "load", refName: "c1" });
    expect(error.message).toBe("La carga está en a = 6, fuera de la barra (el largo de la barra es L = 5).");
    expect(store.get(atomMemberLoads).brokenElementIds.has("seed-e2")).toBe(true);
  });

  it("la primera carga nace en la primera barra, no en error", () => {
    const store = createStore();
    store.set(atomAddLoad);
    expect(store.get(atomLoads)[0].elementId).toBe("seed-e1");
    expect(store.get(atomResults).status).toBe("ok");
  });

  it("una carga sin barra, o en una barra borrada, es un error", () => {
    const store = createStore();
    store.set(atomAddLoad);
    store.set(atomUpdateLoadField, { id: store.get(atomLoads)[0].id, field: "elementId", value: "" });
    expect(errorsOf(store)[0].message).toBe("No tiene barra: elegí en cuál está.");

    const { store: other } = withBeamLoad();
    other.set(atomRemoveElement, "seed-e2");
    expect(errorsOf(other).map((e) => e.message)).toContain("Está en una barra que ya no existe.");
  });

  it("con FEM a mano, las cargas de esa barra no cuentan y se avisa", () => {
    const { store } = withBeamLoad();
    store.set(atomUpdateElementField, { id: "seed-e2", field: "manualFem", value: true });
    const results = store.get(atomResults);
    if (results.status !== "ok") throw new Error(results.status);
    expect(results.warnings).toMatchObject([{ source: "load", refName: "c1", severity: "warning" }]);
    // El FEM a mano está en cero: sin carga, las reacciones verticales no suman nada.
    const v1 = results.solved.reactions.get(seedNodeIds.v1)![1];
    const v4 = results.solved.reactions.get(seedNodeIds.v4)![1];
    expect(v1 + v4).toBeCloseTo(0, 9);
  });

  it("toda la barra sigue a la barra: con `wholeBar` apagado, b queda donde estaba", () => {
    const { store, load } = withBeamLoad();
    store.set(atomUpdateLoadField, { id: load.id, field: "wholeBar", value: false });
    store.set(atomUpdateLoadField, { id: load.id, field: "b", value: 5 });
    // La viga se alarga a 6: la carga sigue cubriendo de 0 a 5 y lo dice el FEM.
    store.set(atomUpdateNodeField, { id: seedNodeIds.v3, field: "x", value: 6 });
    const fem = store.get(atomMemberLoads).fem.get("seed-e2")!;
    expect(fem.from.shear + fem.to.shear).toBeCloseTo(50, 9);
    expect(fem.from.shear).toBeGreaterThan(fem.to.shear);
  });
});

describe("/frame2d — diagramas (paso 4)", () => {
  function loadedFrame() {
    const store = createStore();
    store.set(atomAddLoad, { elementId: "seed-e2" });
    const load = store.get(atomLoads)[0];
    store.set(atomUpdateLoadField, { id: load.id, field: "q1", value: -10 });
    store.set(atomUpdateLoadField, { id: load.id, field: "q2", value: -10 });
    return store;
  }

  it("cada barra cierra: el diagrama llega a lo que el motor dio en «hacia»", () => {
    const store = loadedFrame();
    const diagrams = store.get(atomMemberDiagrams);
    expect(diagrams.size).toBe(3);
    for (const result of diagrams.values()) {
      if (result.status !== "ok") throw new Error(result.status);
      expect(Math.abs(result.diagram.closure.N)).toBeLessThan(1e-8);
      expect(Math.abs(result.diagram.closure.V)).toBeLessThan(1e-8);
      expect(Math.abs(result.diagram.closure.M)).toBeLessThan(1e-8);
    }
  });

  it("en la viga cargada, V baja qL de punta a punta y M tiene un máximo positivo adentro", () => {
    const result = loadedFrame().get(atomMemberDiagrams).get("seed-e2");
    if (result?.status !== "ok") throw new Error(String(result?.status));
    const { points, keyPoints } = result.diagram;
    expect(points[0].V - points[points.length - 1].V).toBeCloseTo(50, 9);
    const extremum = keyPoints.find((k) => k.kind === "extremum")!;
    expect(extremum.left.M).toBeGreaterThan(0);
    expect(extremum.left.V).toBeCloseTo(0, 9);
  });

  it("una barra con FEM a mano no tiene diagrama, y se sabe por qué", () => {
    const store = loadedFrame();
    store.set(atomUpdateElementField, { id: "seed-e2", field: "manualFem", value: true });
    expect(store.get(atomMemberDiagrams).get("seed-e2")).toEqual({ status: "manual-fem" });
    expect(store.get(atomMemberDiagrams).get("seed-e1")?.status).toBe("ok");
  });

  it("sin resultados no hay diagramas", () => {
    const store = loadedFrame();
    store.set(atomUpdateElementField, { id: "seed-e2", field: "inertia", value: 0 });
    expect(store.get(atomMemberDiagrams).size).toBe(0);
  });
});

describe("/frame2d — deformada entre nudos (paso 5)", () => {
  it("en un empotramiento la columna sale sin girar: la flecha crece como x²", () => {
    const shape = createStore().get(atomMemberShapes).get("seed-e1")!;
    const [first, near, twice] = shape.points;
    expect(first.v).toBe(0);
    expect(twice.v / near.v).toBeGreaterThan(3.5);
    expect(twice.v / near.v).toBeLessThan(4.5);
  });

  it("los extremos de cada barra van a donde fueron sus nudos", () => {
    const store = createStore();
    const results = store.get(atomResults);
    if (results.status !== "ok") throw new Error(results.status);
    const shape = store.get(atomMemberShapes).get("seed-e2")!;
    const [dx, dz] = results.solved.displacements.get(seedNodeIds.v3)!;
    const end = shape.points[shape.points.length - 1];
    // Viga horizontal: u es dx y v es dz.
    expect(end.u).toBeCloseTo(dx, 12);
    expect(end.v).toBeCloseTo(dz, 12);
  });

  it("con FEM a mano la barra se curva solo por sus extremos, y queda marcado", () => {
    const store = createStore();
    store.set(atomUpdateElementField, { id: "seed-e2", field: "manualFem", value: true });
    expect(store.get(atomMemberShapes).get("seed-e2")?.homogeneousOnly).toBe(true);
    expect(store.get(atomMemberShapes).get("seed-e1")?.homogeneousOnly).toBe(false);
  });
});

describe("/frame2d — verificación de equilibrio (paso 6)", () => {
  it("el pórtico inicial cierra: con dos empotramientos, la suma de momentos lleva brazos", () => {
    // Antes daba «no cierra»: sumaba los dos momentos de reacción (9.19) como
    // si fueran una componente más, sin brazo de palanca.
    const { equilibrium } = solvedOf(createStore());
    expect(equilibrium.ok).toBe(true);
    for (const value of equilibrium.global) expect(Math.abs(value)).toBeLessThan(1e-9);
  });

  it("con cargas en las barras también, y la columna «carga» del nudo es solo lo que se cargó ahí", () => {
    const store = createStore();
    store.set(atomAddLoad, { elementId: "seed-e2" });
    const load = store.get(atomLoads)[0];
    store.set(atomUpdateLoadField, { id: load.id, field: "q1", value: -10 });
    store.set(atomUpdateLoadField, { id: load.id, field: "q2", value: -10 });
    const { equilibrium } = solvedOf(store);
    expect(equilibrium.ok).toBe(true);
    const v2 = equilibrium.nodes.find((n) => n.nodeId === seedNodeIds.v2)!;
    expect(v2.applied).toEqual([0, 0, 0]);
  });
});

describe("/frame2d — lo genérico de los otros sistemas (paso 6)", () => {
  it("clasificación del pórtico inicial: 3·3 + 6 − 3·4 = 3, hiperestático, y el motor lo confirma", () => {
    const classification = createStore().get(atomClassification);
    if (classification.status !== "counted") throw new Error(classification.status);
    expect(classification).toMatchObject({ bars: 3, reactions: 6, nodes: 4 });
    expect(classification.count.degree).toBe(3);
    expect(classification.verdict).toBe("indeterminate");
  });

  it("con articulado y móvil en las bases queda isostático (g = 0)", () => {
    const store = createStore();
    store.set(atomToggleNodeRestrained, { id: seedNodeIds.v1, axis: "r" });
    store.set(atomToggleNodeRestrained, { id: seedNodeIds.v4, axis: "r" });
    store.set(atomToggleNodeRestrained, { id: seedNodeIds.v4, axis: "x" });
    const classification = store.get(atomClassification);
    if (classification.status !== "counted") throw new Error(classification.status);
    expect(classification.count.degree).toBe(0);
  });

  it("«restringidos arriba» pone los grados restringidos primero, sin cambiar los resultados", () => {
    const store = createStore();
    const before = solvedOf(store);
    store.set(atomToggleRestrainedFirst);
    const after = solvedOf(store);
    expect(after.assembly.dofOrder[0].restrained).toBe(true);
    expect(before.assembly.dofOrder[0].restrained).toBe(true);
    // Cambia el orden de las filas, no la física.
    expect(after.displacements.get(seedNodeIds.v3)![0]).toBeCloseTo(before.displacements.get(seedNodeIds.v3)![0], 12);
    expect(after.assembly.dofOrder.slice(0, 6).every((d) => d.restrained)).toBe(true);
  });

  it("la numeración manual se siembra con el orden de la tabla al encenderla", () => {
    const store = createStore();
    store.set(atomToggleUseDofNumbers);
    const [v1, v2] = store.get(atomNodes);
    expect([v1.dofNumberX, v1.dofNumberZ, v1.dofNumberR, v2.dofNumberX]).toEqual([1, 2, 3, 4]);
    expect(store.get(atomResults).status).toBe("ok");
  });

  it("«aplicar a todas» fija A, I y E en cada barra", () => {
    const store = createStore();
    store.set(atomSetAllElementsNumber, { area: 2, inertia: 3, elasticity: 4 });
    for (const e of store.get(atomElements)) expect([e.area, e.inertia, e.elasticity]).toEqual([2, 3, 4]);
  });

  it("insertar un nudo debajo de otro", () => {
    const store = createStore();
    store.set(atomAddNode, seedNodeIds.v1);
    expect(store.get(atomNodes).map((n) => n.name)).toEqual(["v1", "v5", "v2", "v3", "v4"]);
  });
});

describe("/frame2d — la narrativa reproduce la solución (paso 7)", () => {
  /**
   * Con cargas en las barras, las ecuaciones que muestra la partición son
   * `Uf = Kff⁻¹·(Ff − FEMf − Kfr·Ur)` y `Rr = Krf·Uf + Krr·Ur + FEMr`. Si el
   * signo de `fixedEndForces` estuviera al revés, el alumno haría la cuenta de
   * la pantalla y no le daría el resultado de al lado.
   */
  it("con q en la viga, la sustitución numérica da los desplazamientos y las reacciones del motor", () => {
    const store = createStore();
    store.set(atomAddLoad, { elementId: "seed-e2" });
    const load = store.get(atomLoads)[0];
    store.set(atomUpdateLoadField, { id: load.id, field: "q1", value: -10 });
    store.set(atomUpdateLoadField, { id: load.id, field: "q2", value: -10 });
    const solved = solvedOf(store);
    const { partition, fixedEndForces, dofOrder } = solved.assembly;
    const nodes = new Map(store.get(atomNodes).map((n) => [n.id, n]));
    const entry = (globalIndex: number) => dofOrder.find((e) => e.globalIndex === globalIndex)!;
    const force = (g: number) => {
      const e = entry(g);
      const n = nodes.get(e.nodeId)!;
      return [n.forceX, n.forceZ, n.momentR][e.localDof];
    };

    const ff = partition.free.map((g) => [force(g)]);
    const femF = partition.free.map((g) => [fixedEndForces[g]]);
    const femR = partition.restrained.map((g) => [fixedEndForces[g]]);
    const ur = partition.restrained.map(() => [0]);

    const uf = multiply(inv(partition.kff), subtract(subtract(ff, femF), multiply(partition.kfr, ur))) as number[][];
    partition.free.forEach((g, i) => {
      const e = entry(g);
      expect(uf[i][0]).toBeCloseTo(solved.displacements.get(e.nodeId)![e.localDof], 12);
    });

    const rr = add(add(multiply(partition.krf, uf), multiply(partition.krr, ur)), femR) as number[][];
    partition.restrained.forEach((g, i) => {
      const e = entry(g);
      expect(rr[i][0]).toBeCloseTo(solved.reactions.get(e.nodeId)![e.localDof], 8);
    });
    // Y el término no es de adorno: sin cargas de barra sería cero.
    expect(femF.some(([v]) => v !== 0)).toBe(true);
  });

  it("sin cargas en las barras el vector FEM global es todo ceros (y las ecuaciones quedan como siempre)", () => {
    const { fixedEndForces } = solvedOf(createStore()).assembly;
    expect(fixedEndForces.every((v) => v === 0)).toBe(true);
    expect(fixedEndForces.some((v) => Object.is(v, -0))).toBe(false);
  });
});

describe("/frame2d — mecanismo con cargas en las barras (paso 8)", () => {
  function beamLoaded(store = createStore()) {
    store.set(atomUpdateNodeField, { id: seedNodeIds.v3, field: "forceX", value: 0 });
    store.set(atomAddLoad, { elementId: "seed-e2" });
    const load = store.get(atomLoads)[0];
    store.set(atomUpdateLoadField, { id: load.id, field: "q1", value: -10 });
    store.set(atomUpdateLoadField, { id: load.id, field: "q2", value: -10 });
    return store;
  }

  it("la carga equivalente por nudo es la de la tabla: qL/2 hacia abajo y ∓qL²/12", () => {
    const { equivalentByNode } = beamLoaded().get(atomMemberLoads);
    const [x2, z2, m2] = equivalentByNode.get(seedNodeIds.v2)!;
    const [, z3, m3] = equivalentByNode.get(seedNodeIds.v3)!;
    expect(x2).toBeCloseTo(0, 9);
    expect(z2).toBeCloseTo(-25, 9);
    expect(m2).toBeCloseTo(-250 / 12, 9);
    expect(z3).toBeCloseTo(-25, 9);
    expect(m3).toBeCloseTo(250 / 12, 9);
  });

  it("sin apoyos verticales, la carga de la viga empuja en la dirección del mecanismo: no hay equilibrio", () => {
    // El caso que motivó sumar la carga equivalente: todas las cargas están en
    // la viga, ninguna en los nudos. Contra las cargas nodales solas, el
    // veredicto de Fredholm saldría «hay equilibrio».
    const store = beamLoaded();
    for (const id of [seedNodeIds.v1, seedNodeIds.v4]) {
      store.set(atomToggleNodeRestrained, { id, axis: "z" });
      store.set(atomToggleNodeRestrained, { id, axis: "r" });
    }
    const [error] = errorsOf(store);
    const mode = error.mechanism?.mode;
    if (!mode) throw new Error("sin modo de mecanismo");
    const nodes = new Map(store.get(atomNodes).map((n) => [n.id, n]));
    const { equivalentByNode } = store.get(atomMemberLoads);
    const forces = mode.map((dof) => {
      const n = nodes.get(dof.nodeId)!;
      return [n.forceX, n.forceZ, n.momentR][dof.localDof] + (equivalentByNode.get(dof.nodeId)?.[dof.localDof] ?? 0);
    });
    const nodalOnly = mode.map((dof) => {
      const n = nodes.get(dof.nodeId)!;
      return [n.forceX, n.forceZ, n.momentR][dof.localDof];
    });
    const values = [mode.map((dof) => dof.value)];
    expect(loadCompatibility(values, forces).verdict).toBe("accelerates");
    expect(loadCompatibility(values, nodalOnly).verdict).not.toBe("accelerates");
  });
});
