import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomNodes, atomNodesBase } from "@/app/frame2d/store/nodes";
import { atomElements } from "@/app/frame2d/store/elements";
import { atomLoads, atomUpdateLoadField } from "@/app/frame2d/store/loads";
import { atomCombinationResults, atomLateralAnalysis } from "./analysis";
import { caseViews } from "./cases";
import { atomAddNodalLoad, atomUpdateNodalLoad, atomUpdateSeismicParams, atomUpdateLevelInput, type CaseId } from "./model";
import {
  atomSeismicPersistable,
  createSeismicStore,
  isPersistedSeismicModel,
  seedSeismicModel,
} from "./persistence";
import { atomDiaphragms, atomLevels, atomSeismicForces, deriveLevels } from "./seismic";

/**
 * El ejemplo inicial: dos pisos (3.5 y 3 m) y un vano de 6 m, en t y m. CM
 * 3 y 2.5 t/m en las vigas, CV 1.2 y 0.6 t/m; P₁ = 30 t, P₂ = 20 t; zona 4,
 * S = 1.10, T_P = 0.6, U = 1, R = 8, C_T = 35.
 */
const solved = (store: ReturnType<typeof createStore>, id: CaseId) => {
  const results = store.get(caseViews[id].atomResults);
  if (results.status !== "ok") throw new Error(`${id}: ${results.status}`);
  return results.solved;
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const reactionsSum = (store: ReturnType<typeof createStore>, id: CaseId, dof: number) =>
  sum([...solved(store, id).reactions.values()].map((r) => r[dof]));

describe("el store de la página", () => {
  it("aísla el pórtico de /frame2d: mismos átomos, otros valores", () => {
    const frame2d = createStore();
    const seismic = createSeismicStore(null);
    expect(seismic.get(atomNodes)).toHaveLength(6);
    expect(frame2d.get(atomNodes)).toHaveLength(4);
    expect(seismic.get(atomElements)).toHaveLength(6);
  });
});

describe("niveles", () => {
  it("salen de las cotas: los nudos con la x libre, de abajo hacia arriba", () => {
    const store = createSeismicStore(null);
    const levels = store.get(atomLevels);
    expect(levels.map((l) => [l.name, l.height, l.nodeIds.length])).toEqual([
      ["Nivel 1", 3.5, 2],
      ["Nivel 2", 6.5, 2],
    ]);
    expect(store.get(atomDiaphragms)).toHaveLength(2);
  });

  it("un nudo con la x restringida no entra; un nivel de un nudo no es diafragma", () => {
    const nodes = seedSeismicModel().nodes;
    nodes[5].restrainedX = true; // v6
    const levels = deriveLevels(nodes);
    expect(levels[1].nodeIds).toEqual([nodes[4].id]);
  });
});

describe("fuerzas sísmicas (E.030)", () => {
  it("el ejemplo, hecho a mano", () => {
    const forces = createSeismicStore(null).get(atomSeismicForces);
    if (forces.status !== "ok" || forces.mode !== "e030") throw new Error(forces.status);

    expect(forces.T).toBeCloseTo(6.5 / 35, 12);
    expect(forces.amplification.C).toBe(2.5);
    expect(forces.R).toBe(8);
    // V = 0.45 · 1 · 2.5 · 1.1 / 8 · 50
    const V = (0.45 * 2.5 * 1.1 * 50) / 8;
    expect(forces.detail.baseShear).toBeCloseTo(V, 12);
    // α = P·h / Σ P·h, con Σ = 30·3.5 + 20·6.5 = 235
    expect(forces.forces[0]).toBeCloseTo((V * 105) / 235, 12);
    expect(forces.forces[1]).toBeCloseTo((V * 130) / 235, 12);
    expect(forces.driftScale).toBe(1);
  });

  it("si C/R < 0.11, las derivas usan el V sin el mínimo", () => {
    const store = createSeismicStore(null);
    store.set(atomUpdateSeismicParams, { R0: 30 });
    const forces = store.get(atomSeismicForces);
    if (forces.status !== "ok") throw new Error(forces.status);
    expect(forces.driftScale).toBeCloseTo(2.5 / 30 / 0.11, 12);
  });

  it("las Fᵢ escritas a mano entran tal cual", () => {
    const store = createSeismicStore(null);
    store.set(atomUpdateSeismicParams, { forceMode: "manual" });
    store.set(atomUpdateLevelInput, { field: "manualForces", index: 0, value: 4 });
    store.set(atomUpdateLevelInput, { field: "manualForces", index: 1, value: 6 });
    const forces = store.get(atomSeismicForces);
    expect(forces).toMatchObject({ status: "ok", mode: "manual", forces: [4, 6], driftScale: 1 });
    expect(reactionsSum(store, "CS", 0)).toBeCloseTo(-10, 9);
  });

  it("datos inválidos son un error del caso CS, y los otros dos casos siguen", () => {
    const store = createSeismicStore(null);
    store.set(atomUpdateSeismicParams, { Z: 0 });
    const cs = store.get(caseViews.CS.atomResults);
    expect(cs.status).toBe("error");
    expect(store.get(caseViews.CM.atomResults).status).toBe("ok");
    expect(store.get(atomCombinationResults)).toEqual({ status: "unavailable", reason: "case-error" });
  });
});

describe("los tres casos", () => {
  it("cada uno con sus cargas: las reacciones verticales igualan la carga del caso", () => {
    const store = createSeismicStore(null);
    expect(reactionsSum(store, "CM", 1)).toBeCloseTo(3 * 6 + 2.5 * 6, 8);
    expect(reactionsSum(store, "CV", 1)).toBeCloseTo(1.2 * 6 + 0.6 * 6, 8);
    expect(reactionsSum(store, "CS", 1)).toBeCloseTo(0, 8);
  });

  it("CS: el corte en la base es V, y los nudos de cada piso se mueven juntos", () => {
    const store = createSeismicStore(null);
    const V = (0.45 * 2.5 * 1.1 * 50) / 8;
    expect(reactionsSum(store, "CS", 0)).toBeCloseTo(-V, 9);
    const u = solved(store, "CS").displacements;
    const nodes = store.get(atomNodes);
    expect(u.get(nodes[2].id)![0]).toBe(u.get(nodes[3].id)![0]);
    expect(u.get(nodes[4].id)![0]).toBe(u.get(nodes[5].id)![0]);
  });

  it("cambiar el caso de una carga la mueve de caso", () => {
    const store = createSeismicStore(null);
    const c3 = store.get(atomLoads).find((l) => l.name === "c3")!;
    store.set(atomUpdateLoadField, { id: c3.id, field: "loadCase", value: "CM" });
    expect(reactionsSum(store, "CM", 1)).toBeCloseTo(33 + 1.2 * 6, 8);
    expect(reactionsSum(store, "CV", 1)).toBeCloseTo(0.6 * 6, 8);
  });

  it("las cargas en nudos van por caso, y una en un nudo que no existe es un error de ese caso", () => {
    const store = createSeismicStore(null);
    store.set(atomAddNodalLoad);
    const [row] = store.get(atomSeismicPersistable).nodalLoads;
    store.set(atomUpdateNodalLoad, { id: row.id, field: "loadCase", value: "CV" });
    store.set(atomUpdateNodalLoad, { id: row.id, field: "forceZ", value: -5 });
    expect(reactionsSum(store, "CV", 1)).toBeCloseTo(10.8 + 5, 8);

    store.set(atomNodesBase, (nodes) => nodes.filter((n) => n.id !== row.nodeId));
    const cv = store.get(caseViews.CV.atomResults);
    expect(cv.status).toBe("error");
    expect(cv.status === "error" && cv.errors[0].message).toMatch(/nudo que ya no existe/);
  });
});

describe("rigidez lateral y derivas", () => {
  it("K_L⁻¹·F da los desplazamientos del análisis completo de CS", () => {
    const lateral = createSeismicStore(null).get(atomLateralAnalysis);
    if (lateral.status !== "ok") throw new Error(lateral.status);
    expect(lateral.condensation.condensed).toHaveLength(2);
    lateral.condensedDisplacements.forEach((d, i) => expect(d).toBeCloseTo(lateral.displacements[i], 12));
    expect(lateral.condensation.condensed[0][1]).toBeCloseTo(lateral.condensation.condensed[1][0], 3);
  });

  it("derivas con 0.75R sobre los desplazamientos de CS", () => {
    const lateral = createSeismicStore(null).get(atomLateralAnalysis);
    if (lateral.status !== "ok") throw new Error(lateral.status);
    expect(lateral.inelasticFactor).toBe(6);
    const [first, second] = lateral.drifts;
    expect(first.inelastic).toBeCloseTo(lateral.displacements[0] * 6, 12);
    expect(second.drift).toBeCloseTo((lateral.displacements[1] - lateral.displacements[0]) * 6, 12);
    expect(second.storyHeight).toBe(3);
    expect(lateral.rayleighPeriod).toBeGreaterThan(0);
  });
});

describe("combinaciones y envolvente", () => {
  it("las cinco de la E.060: cada una es la suma de los casos por sus factores", () => {
    const store = createSeismicStore(null);
    const result = store.get(atomCombinationResults);
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.combinations).toHaveLength(5);

    const v1 = store.get(atomNodes)[0].id;
    const [u1, u2] = result.combinations;
    const r = (id: CaseId) => solved(store, id).reactions.get(v1)!;
    u1.reactions.get(v1)!.forEach((value, i) => expect(value).toBeCloseTo(1.4 * r("CM")[i] + 1.7 * r("CV")[i], 9));
    u2.reactions.get(v1)!.forEach((value, i) =>
      expect(value).toBeCloseTo(1.25 * (r("CM")[i] + r("CV")[i]) + r("CS")[i], 9),
    );
    for (const diagram of u2.diagrams.values()) expect(Math.abs(diagram.closure.M)).toBeLessThan(1e-8);
  });

  it("la envolvente cubre las seis barras y las reacciones de los dos apoyos", () => {
    const result = createSeismicStore(null).get(atomCombinationResults);
    if (result.status !== "ok") throw new Error(result.status);
    expect(result.envelope.size).toBe(6);
    expect(result.reactions.size).toBe(2);
    for (const { max, min } of result.reactions.values()) max.forEach((value, i) => expect(value).toBeGreaterThanOrEqual(min[i]));
  });
});

describe("persistencia", () => {
  it("el ejemplo es un modelo válido, y se rechaza un caso que no existe", () => {
    const model = seedSeismicModel();
    expect(isPersistedSeismicModel(model)).toBe(true);
    expect(isPersistedSeismicModel(JSON.parse(JSON.stringify(model)))).toBe(true);
    const broken = JSON.parse(JSON.stringify(model));
    broken.loads[0].loadCase = "CW";
    expect(isPersistedSeismicModel(broken)).toBe(false);
    const noParams = JSON.parse(JSON.stringify(model));
    delete noParams.params.Z;
    expect(isPersistedSeismicModel(noParams)).toBe(false);
  });

  it("restaurar copia: editar el store no toca el modelo de origen", () => {
    const model = seedSeismicModel();
    const store = createSeismicStore(model);
    store.set(atomUpdateSeismicParams, { Z: 0.1 });
    store.set(atomUpdateLevelInput, { field: "weights", index: 0, value: 99 });
    expect(model.params.Z).toBe(0.45);
    expect(model.levels.weights[0]).toBe(30);
    expect(store.get(atomSeismicPersistable).params.Z).toBe(0.1);
  });
});
