import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomClassification } from "./classification";
import { seedElements } from "./elements";
import { examples } from "./examples";
import { seedNodes } from "./nodes";
import type { PersistedModel } from "./persisted-model";
import { atomRestoreModel } from "./persistence";

function classify(model: PersistedModel) {
  const store = createStore();
  store.set(atomRestoreModel, model);
  return store.get(atomClassification);
}

const seed = (): PersistedModel => ({
  nodes: seedNodes(),
  elements: seedElements(),
  restrainedFirst: false,
  useDofNumbers: false,
});

/** El cuadro del ejemplo inicial sin sus dos diagonales: cuatro barras en ronda. */
function squareWithoutDiagonals(): PersistedModel {
  const model = seed();
  model.elements = model.elements.filter((e) => e.name !== "e5" && e.name !== "e6");
  return model;
}

describe("clasificación de /armaduras-2d", () => {
  it("el ejemplo inicial: 6 + 4 − 2·4 = 2, hiperestático, y la matriz lo confirma", () => {
    expect(classify(seed())).toMatchObject({
      status: "counted",
      bars: 6,
      reactions: 4,
      nodes: 4,
      count: { degree: 2 },
      verdict: "indeterminate",
    });
  });

  it("el triángulo de los ejemplos es isostático, que es la razón por la que está en la lista", () => {
    const triangle = examples.find((e) => e.name.startsWith("Triángulo"))!;
    expect(classify(triangle.model)).toMatchObject({ count: { degree: 0 }, verdict: "determinate" });
  });

  it("los tres ejemplos resuelven, así que el veredicto sigue al signo del conteo", () => {
    for (const example of examples) {
      const result = classify(example.model);
      if (result.status !== "counted") throw new Error(example.name);
      expect(result.verdict, example.name).toBe(result.count.degree === 0 ? "determinate" : "indeterminate");
    }
  });

  it("el conteo da isostático y es un mecanismo: necesaria, no suficiente", () => {
    // 4 + 4 − 8 = 0. Las barras alcanzan en número, pero sin diagonal el cuadro
    // se deforma en paralelogramo sin alargar ninguna.
    expect(classify(squareWithoutDiagonals())).toMatchObject({
      count: { degree: 0 },
      verdict: "unstable-by-arrangement",
    });
  });

  it("con incógnitas de menos, el conteo solo alcanza para afirmar el mecanismo", () => {
    const model = squareWithoutDiagonals();
    // v2 pasa de fijo a rodillo: una reacción menos, 4 + 3 − 8 = −1.
    model.nodes.find((n) => n.name === "v2")!.restrainedX = false;
    expect(classify(model)).toMatchObject({ count: { degree: -1 }, verdict: "unstable-by-count" });
  });

  it("con errores de datos, dice lo que da la cuenta y que falta confirmarlo", () => {
    const model = seed();
    model.elements[0].area = 0;
    expect(classify(model)).toMatchObject({ count: { degree: 2 }, verdict: "unconfirmed" });
  });

  it("sin barras no hay nada que clasificar", () => {
    expect(classify({ ...seed(), elements: [] })).toEqual({ status: "empty" });
  });
});
