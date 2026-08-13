import { describe, expect, it } from "vitest";

import { axialLabelPoint } from "./axial-label";

/**
 * La armadura semilla proyectada a SVG (y hacia abajo): v1 abajo-izquierda,
 * v2 abajo-derecha, v3 arriba-izquierda, v4 arriba-derecha.
 */
const v1 = { x: 0, y: 0 };
const v2 = { x: 3, y: 0 };
const v3 = { x: 0, y: -4 };
const v4 = { x: 3, y: -4 };
const center = { x: 1.5, y: -2 };
const UNIT = 0.13;

describe("axialLabelPoint", () => {
  it("pone el número al 25% de la barra, no en el medio", () => {
    // Las dos diagonales de la armadura semilla se cruzan justo en su punto
    // medio: centrados, los dos números caerían exactamente en el mismo lugar.
    const e5 = axialLabelPoint(v1, v4, UNIT, center); // v1 ↔ v4
    const e6 = axialLabelPoint(v2, v3, UNIT, center); // v2 ↔ v3

    expect(Math.hypot(e5.x - e6.x, e5.y - e6.y)).toBeGreaterThan(1);
  });

  it("corre el número hacia afuera de la figura, no hacia adentro", () => {
    const izquierda = axialLabelPoint(v1, v3, UNIT, center); // cordón izquierdo
    const derecha = axialLabelPoint(v2, v4, UNIT, center); // cordón derecho
    const abajo = axialLabelPoint(v1, v2, UNIT, center); // cordón inferior

    expect(izquierda.x).toBeLessThan(0);
    expect(derecha.x).toBeGreaterThan(3);
    // En SVG y crece hacia abajo, así que "afuera" del cordón inferior es +y.
    expect(abajo.y).toBeGreaterThan(0);
  });

  it("ancla el número por el lado que da a la barra cuando la barra es vertical", () => {
    // Sin esto el corrimiento no alcanza: el texto mide varias veces lo que se
    // corre, así que centrado vuelve a cruzar su propia barra.
    expect(axialLabelPoint(v1, v3, UNIT, center).anchor).toBe("end");
    expect(axialLabelPoint(v2, v4, UNIT, center).anchor).toBe("start");
  });

  it("deja centrado el número de una barra horizontal", () => {
    // Ahí el corrimiento vertical ya despeja la barra, porque lo que mide poco
    // es el alto del texto.
    expect(axialLabelPoint(v1, v2, UNIT, center).anchor).toBe("middle");
  });

  it("no cambia de lado porque el nudo se haya desplazado una milésima", () => {
    // La regresión que encontró la captura: con la regla anterior ("correr
    // siempre hacia arriba en pantalla"), en una barra casi vertical el signo de
    // la componente vertical de la perpendicular lo decidía el ruido, y este
    // desplazamiento daba vuelta el lado — apilando este número sobre el de la
    // barra de al lado.
    const derecho = axialLabelPoint(v2, v4, UNIT, center);
    const derechoDeformado = axialLabelPoint(v2, { x: 3.004, y: -4 }, UNIT, center);

    expect(derechoDeformado.anchor).toBe(derecho.anchor);
    expect(Math.sign(derechoDeformado.x - 3)).toBe(Math.sign(derecho.x - 3));
  });

  it("no explota con una barra de longitud cero", () => {
    const punto = axialLabelPoint(v1, v1, UNIT, center);

    expect(Number.isFinite(punto.x)).toBe(true);
    expect(Number.isFinite(punto.y)).toBe(true);
  });
});
