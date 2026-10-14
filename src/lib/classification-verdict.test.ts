import { describe, expect, it } from "vitest";

import { classificationVerdict } from "./classification-verdict";

describe("classificationVerdict — el conteo cruzado con la matriz", () => {
  it("con incógnitas de menos es inestable, diga lo que diga el cálculo", () => {
    expect(classificationVerdict(-1, "mechanism")).toBe("unstable-by-count");
    expect(classificationVerdict(-1, "data-errors")).toBe("unstable-by-count");
  });

  it("si el conteo alcanza y la matriz encontró un mecanismo, el problema es la disposición", () => {
    expect(classificationVerdict(0, "mechanism")).toBe("unstable-by-arrangement");
    expect(classificationVerdict(2, "mechanism")).toBe("unstable-by-arrangement");
  });

  it("solo afirma isostática o hiperestática cuando la matriz lo confirma", () => {
    expect(classificationVerdict(0, "solved")).toBe("determinate");
    expect(classificationVerdict(3, "solved")).toBe("indeterminate");
    expect(classificationVerdict(3, "data-errors")).toBe("unconfirmed");
  });
});
