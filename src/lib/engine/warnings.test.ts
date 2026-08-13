import { describe, expect, it } from "vitest";

import { CONDITION_WARNING, illConditionedWarning, unconnectedNodeWarnings } from "./warnings";

describe("illConditionedWarning", () => {
  it("no dice nada cuando el condicionamiento es sano", () => {
    // Una armadura normal anda entre 10² y 10⁵.
    expect(illConditionedWarning(1e3)).toBeNull();
    expect(illConditionedWarning(CONDITION_WARNING)).toBeNull();
  });

  it("avisa cuando se perdieron la mitad de los dígitos", () => {
    const warning = illConditionedWarning(1e10);

    expect(warning?.code).toBe("ill-conditioned");
    // No se puede atribuir a una fila: es del modelo entero.
    expect(warning?.source).toBe("system");
    expect(warning?.message).toContain("10^10");
  });

  it("no explota con un número que no es número", () => {
    // `conditionEstimate` puede dar Infinity si la norma de la inversa se
    // dispara; ahí el que corta es el límite duro, no esto.
    expect(illConditionedWarning(Infinity)).toBeNull();
    expect(illConditionedWarning(NaN)).toBeNull();
  });
});

describe("unconnectedNodeWarnings", () => {
  const elements = [{ nodeIds: ["a", "b"] }, { nodeIds: ["b", "c"] }];

  it("no dice nada cuando todos los nudos tienen barra", () => {
    expect(unconnectedNodeWarnings(["a", "b", "c"], elements)).toEqual([]);
  });

  it("señala el nudo suelto, y solo ese", () => {
    const warnings = unconnectedNodeWarnings(["a", "b", "c", "d"], elements);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].refId).toBe("d");
    expect(warnings[0].source).toBe("node");
  });

  it("el mensaje no nombra la fila: el motor solo conoce ids", () => {
    const [warning] = unconnectedNodeWarnings(["seed-v5"], []);

    // Quien lo muestra resuelve el nombre con `refId`. Si el motor lo metiera
    // en el texto, la pantalla diría "el nudo seed-v5", que no le dice nada a
    // nadie.
    expect(warning.refId).toBe("seed-v5");
    expect(warning.message).not.toContain("seed-v5");
  });
});
