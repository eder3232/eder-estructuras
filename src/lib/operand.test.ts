import { describe, expect, it } from "vitest";
import { operand } from "./operand";

describe("operand", () => {
  it("deja los positivos y el cero como están", () => {
    expect(operand(0.3293, 4)).toBe("0.3293");
    expect(operand(0, 2)).toBe("0.00");
  });

  it("pone los negativos entre paréntesis", () => {
    expect(operand(-0.3293, 4)).toBe("(-0.3293)");
  });
});
