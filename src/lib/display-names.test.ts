import { describe, expect, it } from "vitest";

import { displayNames, withDisplayNames } from "./display-names";

describe("withDisplayNames", () => {
  const names = displayNames(
    [
      { id: "seed-v1", name: "v1" },
      { id: "seed-v10", name: "apoyo" },
    ],
    [{ id: "seed-e4", name: "e4" }],
  );

  it("cambia cada id por su nombre, nudos y elementos en el mismo mensaje", () => {
    expect(withDisplayNames("El elemento seed-e4 referencia al nodo seed-v1, que no existe.", names)).toBe(
      "El elemento e4 referencia al nodo v1, que no existe.",
    );
  });

  it("no confunde un id con el principio de otro más largo", () => {
    expect(withDisplayNames("El nodo seed-v10 ya existe.", names)).toBe("El nodo apoyo ya existe.");
  });

  it("deja igual un mensaje sin ids", () => {
    expect(withDisplayNames("La estructura es un mecanismo.", names)).toBe("La estructura es un mecanismo.");
  });
});
