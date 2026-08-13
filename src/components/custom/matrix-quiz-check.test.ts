import { describe, expect, it } from "vitest";

import { cellKey, checkPositions, checkValue, countOk } from "./matrix-quiz-check";

describe("checkPositions", () => {
  const esperadas = [cellKey(0, 0), cellKey(0, 1), cellKey(1, 0), cellKey(1, 1)];

  it("separa lo que falta de lo que sobra, que son dos errores distintos", () => {
    const resultado = checkPositions([cellKey(0, 0), cellKey(0, 1), cellKey(2, 2)], esperadas);

    expect(resultado.hit).toEqual([cellKey(0, 0), cellKey(0, 1)]);
    expect(resultado.missing).toEqual([cellKey(1, 0), cellKey(1, 1)]);
    expect(resultado.extra).toEqual([cellKey(2, 2)]);
  });

  it("todo bien es sin faltantes ni sobrantes", () => {
    const resultado = checkPositions(esperadas, esperadas);

    expect(resultado.hit).toHaveLength(4);
    expect(resultado.missing).toEqual([]);
    expect(resultado.extra).toEqual([]);
  });

  it("no marcar nada es todo faltante, no un acierto", () => {
    expect(checkPositions([], esperadas).missing).toHaveLength(4);
  });
});

describe("checkValue", () => {
  it("acepta el redondeo que sale de resolverlo a mano", () => {
    expect(checkValue("6666.67", 6666.6667)).toBe("ok");
    expect(checkValue("6667", 6666.6667)).toBe("ok");
  });

  it("rechaza un valor que no es ese", () => {
    expect(checkValue("6000", 6666.6667)).toBe("wrong");
    // El signo importa: es la mitad de lo que se aprende en el ensamblaje.
    expect(checkValue("6666.6667", -6666.6667)).toBe("wrong");
  });

  it("la tolerancia es relativa, así que un cero es un cero", () => {
    // Con margen absoluto, `10` pasaría por cero al lado de rigideces de 10³.
    expect(checkValue("10", 0)).toBe("wrong");
    expect(checkValue("0", 0)).toBe("ok");
  });

  it("acepta la expresión, que es como el alumno tiene el número mientras lo calcula", () => {
    expect(checkValue("2e7*0.001/3", 6666.6667)).toBe("ok");
    expect(checkValue("20000000*0.001/3", 6666.6667)).toBe("ok");
  });

  it("distingue vacío de mal escrito", () => {
    expect(checkValue("", 5)).toBe("empty");
    expect(checkValue("   ", 5)).toBe("empty");
    expect(checkValue("6666,67", 5)).toBe("invalid");
    expect(checkValue("hola", 5)).toBe("invalid");
  });
});

describe("countOk", () => {
  it("cuenta para poder decir «12 de 16» en vez de un tilde", () => {
    expect(countOk(["ok", "wrong", "ok", "empty"])).toBe(2);
  });
});
