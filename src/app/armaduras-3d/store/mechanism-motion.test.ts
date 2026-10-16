import { describe, expect, it } from "vitest";

import { mechanismMotion } from "./mechanism-motion";

describe("mechanismMotion", () => {
  it("junta las componentes de un nudo en un solo vector", () => {
    const motion = mechanismMotion({
      loose: [],
      mode: [
        { nodeId: "a", localDof: 0, value: 0.6 },
        { nodeId: "a", localDof: 2, value: -0.8 },
        { nodeId: "b", localDof: 1, value: 0.5 },
      ],
    });
    expect(motion).toEqual([
      { nodeId: "a", vector: [0.6, 0, -0.8] },
      { nodeId: "b", vector: [0, 0.5, 0] },
    ]);
  });

  it("normaliza a la mayor norma y descarta los nudos que no se mueven", () => {
    const motion = mechanismMotion({
      loose: [],
      mode: [
        { nodeId: "a", localDof: 0, value: 2 },
        { nodeId: "b", localDof: 0, value: 1e-12 },
      ],
    });
    expect(motion).toEqual([{ nodeId: "a", vector: [1, 0, 0] }]);
  });

  it("sin modo, dibuja los grados sueltos sobre su eje", () => {
    const motion = mechanismMotion({ loose: [{ nodeId: "d", localDof: 2 }], mode: null });
    expect(motion).toEqual([{ nodeId: "d", vector: [0, 0, 1] }]);
  });
});
