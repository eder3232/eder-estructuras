import { describe, expect, it } from "vitest";

import { insertIndex, nextRowName } from "./row-names";

describe("nextRowName", () => {
  it("sigue la numeración cuando no falta ninguno", () => {
    expect(nextRowName("v", ["v1", "v2", "v3"])).toBe("v4");
    expect(nextRowName("e", [])).toBe("e1");
  });

  it("reusa el hueco que dejó una fila borrada, en vez de repetir un nombre", () => {
    // Con `v${largo + 1}` este caso devolvía "v3", que ya existe.
    expect(nextRowName("v", ["v1", "v3"])).toBe("v2");
  });

  it("ignora los nombres que el usuario cambió a mano", () => {
    expect(nextRowName("v", ["apoyo izq", "v2"])).toBe("v1");
  });
});

describe("insertIndex", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("agrega al final si no se pasa una fila de referencia", () => {
    expect(insertIndex(rows)).toBe(3);
  });

  it("inserta justo debajo de la fila de referencia", () => {
    expect(insertIndex(rows, "a")).toBe(1);
    expect(insertIndex(rows, "c")).toBe(3);
  });

  it("cae al final si la fila de referencia ya no existe", () => {
    expect(insertIndex(rows, "borrada")).toBe(3);
  });
});
