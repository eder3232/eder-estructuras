import { describe, expect, it } from "vitest";

import { determinacy } from "./classification";

describe("determinacy — g = (incógnitas por barra)·b + r − (grados por nudo)·n", () => {
  it("cuenta una armadura plana: el cuadro arriostrado del ejemplo inicial es hiperestático de grado 2", () => {
    // 6 barras, 2 apoyos fijos (4 reacciones), 4 nudos: 6 + 4 − 8.
    expect(determinacy({ unknownsPerElement: 1, dofPerNode: 2, elements: 6, nodes: 4, reactions: 4 })).toEqual({
      unknowns: 10,
      equations: 8,
      degree: 2,
    });
  });

  it("un triángulo con fijo y rodillo es isostático", () => {
    expect(determinacy({ unknownsPerElement: 1, dofPerNode: 2, elements: 3, nodes: 3, reactions: 3 }).degree).toBe(0);
  });

  it("un cuadro sin diagonal da negativo: falta una barra", () => {
    expect(determinacy({ unknownsPerElement: 1, dofPerNode: 2, elements: 4, nodes: 4, reactions: 3 }).degree).toBe(-1);
  });

  it("los coeficientes son lo único que cambia entre sistemas: un pórtico biempotrado de una barra es de grado 3", () => {
    expect(determinacy({ unknownsPerElement: 3, dofPerNode: 3, elements: 1, nodes: 2, reactions: 6 }).degree).toBe(3);
  });
});
