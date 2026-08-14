import { describe, expect, it } from "vitest";
import { createStore } from "jotai";

import { atomResults } from "./results";
import { atomRestoreModel } from "./persistence";
import { examples } from "./examples";
import { isPersistedModel } from "./persisted-model";

/**
 * N2. Un ejemplo precargado que no resuelve es peor que no tenerlo: el alumno
 * abre la app, elige uno de la lista y lo primero que ve es un mensaje de
 * error, que además no causó él. Así que lo que se afirma acá es que **los tres
 * resuelven**, y de paso que cada uno muestra lo que dice mostrar.
 *
 * La verificación de equilibrio (N5) se usa como control: si un ejemplo
 * estuviera mal armado, el residuo lo delata sin tener que escribir a mano los
 * valores esperados de cada uno.
 */

function resolver(model: (typeof examples)[number]["model"]) {
  const store = createStore();
  store.set(atomRestoreModel, model);
  return store.get(atomResults);
}

describe("ejemplos precargados", () => {
  it("los tres tienen la forma que se guarda", () => {
    // Si esto falla, cargar el ejemplo y recargar la página lo perdería: se
    // guarda, y al leerlo la guarda de N1 lo descartaría.
    for (const example of examples) expect(isPersistedModel(example.model)).toBe(true);
  });

  it("los tres resuelven, sin mecanismos ni errores de datos", () => {
    for (const example of examples) {
      const results = resolver(example.model);
      expect(results.status, example.name).toBe("ok");
    }
  });

  it("los tres cierran en equilibrio", () => {
    for (const example of examples) {
      const results = resolver(example.model);
      if (results.status !== "ok") throw new Error(`${example.name} no resolvió`);
      expect(results.solved.equilibrium.ok, example.name).toBe(true);
    }
  });

  it("no arrastran advertencias", () => {
    // Un nudo suelto o una matriz mal condicionada en un ejemplo de la casa
    // sería un aviso que el alumno no puede sacar.
    for (const example of examples) {
      const results = resolver(example.model);
      if (results.status !== "ok") throw new Error(`${example.name} no resolvió`);
      expect(results.warnings, example.name).toEqual([]);
    }
  });

  it("el triángulo es isostático: los esfuerzos no dependen del material", () => {
    const triangulo = examples.find((e) => e.id === "triangulo")!;
    const duplicado = {
      ...triangulo.model,
      elements: triangulo.model.elements.map((e) => ({ ...e, area: e.area * 3, elasticity: e.elasticity * 7 })),
    };

    const original = resolver(triangulo.model);
    const rigido = resolver(duplicado);
    if (original.status !== "ok" || rigido.status !== "ok") throw new Error("no resolvió");

    // Es la propiedad que ese ejemplo existe para mostrar, y la que el ejemplo
    // inicial —hiperestático— no puede mostrar.
    for (const element of triangulo.model.elements) {
      const antes = (original.solved.internalForces.get(element.id) as { axialForce: number }).axialForce;
      const despues = (rigido.solved.internalForces.get(element.id) as { axialForce: number }).axialForce;
      expect(despues).toBeCloseTo(antes, 8);
    }
  });

  it("la cercha tiene los apoyos en el medio de la tabla, que es su razón de ser", () => {
    const cercha = examples.find((e) => e.id === "cercha")!;
    const restringidos = cercha.model.nodes.map((n) => n.restrainedX || n.restrainedZ);

    // Si los apoyos quedaran primeros, el interruptor de orden no cambiaría
    // nada visible y el ejemplo dejaría de servir para lo que se agregó.
    expect(restringidos[0]).toBe(false);
    expect(restringidos.slice(1).some(Boolean)).toBe(true);
  });

  it("el asentamiento tensiona la estructura sin ninguna carga aplicada", () => {
    const asentamiento = examples.find((e) => e.id === "asentamiento")!;

    // La premisa: no hay una sola fuerza cargada.
    for (const node of asentamiento.model.nodes) {
      expect(node.forceX).toBe(0);
      expect(node.forceZ).toBe(0);
    }

    const results = resolver(asentamiento.model);
    if (results.status !== "ok") throw new Error("no resolvió");

    // Y aun así hay esfuerzos: es hiperestática, las barras se estorban.
    const axiales = [...results.solved.internalForces.values()].map(
      (f) => (f as { axialForce: number }).axialForce,
    );
    expect(axiales.some((n) => Math.abs(n) > 1)).toBe(true);
  });
});
