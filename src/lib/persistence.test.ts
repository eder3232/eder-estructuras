// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { clearPersisted, loadPersisted, savePersisted } from "./persistence";

/**
 * El sobre de lo guardado: versión, descarte de lo que no se entiende, y
 * **nunca romper**. Lo que se afirma acá es sobre todo lo segundo — que un
 * `localStorage` con basura adentro no puede voltear la página.
 */

const KEY = "test:modelo";
const isPair = (value: unknown): value is { a: number } =>
  value !== null && typeof value === "object" && typeof (value as { a: unknown }).a === "number";

afterEach(() => localStorage.clear());

describe("loadPersisted", () => {
  it("sin nada guardado no es un descarte: es la primera visita", () => {
    expect(loadPersisted(KEY, 1, isPair)).toEqual({ data: null, discarded: false });
  });

  it("lee lo que guardó", () => {
    savePersisted(KEY, 1, { a: 7 });

    expect(loadPersisted(KEY, 1, isPair)).toEqual({ data: { a: 7 }, discarded: false });
  });

  it("otra versión se descarta, y se nota", () => {
    savePersisted(KEY, 1, { a: 7 });

    // Vale para las dos direcciones: lo viejo, y lo **más nuevo que este
    // código** — que pasa si el usuario tiene abierta otra pestaña con la app
    // anterior.
    expect(loadPersisted(KEY, 2, isPair)).toEqual({ data: null, discarded: true });
  });

  it("un JSON roto se descarta sin tirar", () => {
    localStorage.setItem(KEY, "{no es json");

    expect(loadPersisted(KEY, 1, isPair)).toEqual({ data: null, discarded: true });
  });

  it("una forma que no pasa la guarda se descarta", () => {
    savePersisted(KEY, 1, { a: "siete" });

    expect(loadPersisted(KEY, 1, isPair)).toEqual({ data: null, discarded: true });
  });

  it("clearPersisted deja el estado de la primera visita", () => {
    savePersisted(KEY, 1, { a: 7 });
    clearPersisted(KEY);

    expect(loadPersisted(KEY, 1, isPair)).toEqual({ data: null, discarded: false });
  });
});
