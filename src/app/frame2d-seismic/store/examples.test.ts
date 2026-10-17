import { describe, expect, it } from "vitest";

import { atomCombinationResults, atomLateralAnalysis } from "./analysis";
import { caseViews } from "./cases";
import { seismicExamples } from "./examples";
import { createSeismicStore, isPersistedSeismicModel, seedSeismicModel } from "./persistence";
import { atomSeismicForces } from "./seismic";

/**
 * Un ejemplo que no muestra lo que dice mostrar es una mentira en el menú: se
 * afirma la lección de cada uno, con los números medidos antes de escribirla.
 */
const byId = (id: string) => seismicExamples.find((e) => e.id === id)!;

function lateralOf(model: Parameters<typeof createSeismicStore>[0]) {
  const lateral = createSeismicStore(model).get(atomLateralAnalysis);
  if (lateral.status !== "ok") throw new Error(lateral.status);
  return lateral;
}

describe("ejemplos de frame2d-seismic", () => {
  it("todos tienen la forma que se guarda, y los tres casos y las combinaciones se resuelven", () => {
    for (const example of seismicExamples) {
      expect(isPersistedSeismicModel(example.model), example.id).toBe(true);
      const store = createSeismicStore(example.model);
      for (const id of ["CM", "CV", "CS"] as const) {
        expect(store.get(caseViews[id].atomResults).status, `${example.id} ${id}`).toBe("ok");
      }
      expect(store.get(atomCombinationResults).status, example.id).toBe("ok");
    }
  });

  it("cargar uno no lo modifica: editar el store no toca el ejemplo", () => {
    const example = byId("tres-pisos");
    const before = JSON.stringify(example.model);
    createSeismicStore(example.model).get(atomCombinationResults);
    expect(JSON.stringify(example.model)).toBe(before);
  });

  it("tres pisos: la columna del medio toma más corte que las de los bordes, y el segundo piso es el que más deriva", () => {
    const example = byId("tres-pisos");
    const store = createSeismicStore(example.model);
    const cs = store.get(caseViews.CS.atomResults);
    if (cs.status !== "ok") throw new Error(cs.status);
    const shear = (id: string) => -cs.solved.reactions.get(`tres-pisos-${id}`)![0];
    expect(shear("a2")).toBeCloseTo(7.2829, 3);
    expect(shear("a1")).toBeCloseTo(5.6398, 3);
    expect(shear("a2") / shear("a1")).toBeGreaterThan(1.25);

    const ratios = lateralOf(example.model).drifts.map((d) => d.ratio);
    expect(ratios[1]).toBeGreaterThan(ratios[0]);
    expect(ratios[1]).toBeGreaterThan(ratios[2]);
    // Ninguno pasa; el de arriba, por poco (0.00715).
    expect(ratios.map((r) => r <= 0.007)).toEqual([false, false, false]);
    expect(ratios[2]).toBeCloseTo(0.00715, 5);
  });

  it("mínimo de C/R: el período escrito es el de Rayleigh del pórtico; manda 0.11 para diseño, no para derivas", () => {
    const example = byId("minimo-cr");
    const forces = createSeismicStore(example.model).get(atomSeismicForces);
    if (forces.status !== "ok" || forces.mode !== "e030") throw new Error(forces.status);
    expect(forces.detail.cOverR).toBeCloseTo(0.1008, 4);
    expect(forces.detail.minimumGoverns).toBe(true);
    expect(forces.detail.baseShear).toBeCloseTo(4.95, 10);
    expect(forces.detail.driftBaseShear).toBeCloseTo(4.5363, 4);

    const lateral = lateralOf(example.model);
    // Coherente: el T escrito es el que la página calcula para este pórtico.
    expect(lateral.rayleighPeriod).toBeCloseTo(1.24, 2);
    expect(lateral.driftScale).toBeCloseTo(0.1008 / 0.11, 3);
    expect(lateral.drifts.every((d) => !d.ok)).toBe(true);
  });

  it("articulado: sin momento en la base, y el primer piso deriva unas cuatro veces lo del pórtico empotrado", () => {
    const example = byId("articulado");
    const store = createSeismicStore(example.model);
    const cs = store.get(caseViews.CS.atomResults);
    if (cs.status !== "ok") throw new Error(cs.status);
    expect(cs.solved.reactions.get("articulado-v1")![2]).toBe(0);

    const pinned = lateralOf(example.model).drifts[0].ratio;
    const fixed = lateralOf(seedSeismicModel()).drifts[0].ratio;
    expect(pinned).toBeCloseTo(0.0286, 4);
    expect(pinned / fixed).toBeGreaterThan(3.5);
    expect(pinned / fixed).toBeLessThan(4.5);
  });
});
