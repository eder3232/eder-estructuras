import { describe, expect, it } from "vitest";

import { equilibriumCheck } from "./equilibrium";
import { System } from "./system";
import { SpringElement } from "./springs/spring-element";
import { TrussElement2D } from "./trusses-2d/truss-element-2d";

/**
 * N5. La comprobación que los scripts de regresión hacían **fuera** del repo y
 * que ahora cierra el panel de resultados: cada nudo en equilibrio.
 *
 * Los casos que importan son dos, y son distintos: que la estructura resuelta
 * cierre, y que el control **se dé cuenta** cuando no cierra. Un control que
 * siempre dice que sí no es un control.
 */

const AREA = 10 * 10 ** -4;
const ELASTICITY = 2 * 10 ** 7;

/** La misma armadura de la regresión: 4 nudos, 6 barras, hiperestática. */
function seedTruss() {
  const points = {
    v1: { id: "v1", x: 0, z: 0 },
    v2: { id: "v2", x: 3, z: 0 },
    v3: { id: "v3", x: 0, z: 4 },
    v4: { id: "v4", x: 3, z: 4 },
  };

  const system = new System(2);
  system.addNode({ id: "v1", restrained: [true, true] });
  system.addNode({ id: "v2", restrained: [true, true] });
  system.addNode({ id: "v3", restrained: [false, false], force: [4.8, -6.4] });
  system.addNode({ id: "v4", restrained: [false, false], force: [0, -6] });

  const elements = [
    new TrussElement2D("e1", points.v1, points.v2, AREA, ELASTICITY),
    new TrussElement2D("e2", points.v3, points.v4, AREA, ELASTICITY),
    new TrussElement2D("e3", points.v1, points.v3, AREA, ELASTICITY),
    new TrussElement2D("e4", points.v2, points.v4, AREA, ELASTICITY),
    new TrussElement2D("e5", points.v1, points.v4, AREA, ELASTICITY),
    new TrussElement2D("e6", points.v2, points.v3, AREA, ELASTICITY),
  ];
  for (const element of elements) system.addElement(element);

  const appliedForces = new Map([
    ["v1", [0, 0]],
    ["v2", [0, 0]],
    ["v3", [4.8, -6.4]],
    ["v4", [0, -6]],
  ]);

  return { system, elements, appliedForces };
}

describe("equilibriumCheck", () => {
  it("la armadura resuelta cierra en cada nudo y en el total", () => {
    const { system } = seedTruss();
    const { equilibrium } = system.solve();

    expect(equilibrium.ok).toBe(true);
    // El residuo es ruido de punto flotante, no cero exacto: la afirmación
    // honesta es que es despreciable **frente a las fuerzas en juego**.
    expect(equilibrium.maxResidual).toBeLessThan(1e-9 * equilibrium.scale + 1e-9);
    expect(equilibrium.scale).toBeGreaterThan(1);

    for (const node of equilibrium.nodes) {
      for (const residual of node.residual) expect(residual).toBeCloseTo(0, 9);
    }
    for (const value of equilibrium.global) expect(value).toBeCloseTo(0, 9);
  });

  it("cada barra tira de sus dos nudos con fuerzas iguales y opuestas", () => {
    const { system } = seedTruss();
    const { equilibrium } = system.solve();

    // Es lo que hace que en el total las barras se cancelen y solo queden las
    // cargas y las reacciones — la lección de la fila global de la tabla.
    for (const elementId of ["e1", "e2", "e3", "e4", "e5", "e6"]) {
      const ends = equilibrium.nodes.flatMap((node) =>
        node.elements.filter((e) => e.elementId === elementId),
      );
      expect(ends).toHaveLength(2);
      expect(ends[0].force[0]).toBeCloseTo(-ends[1].force[0], 9);
      expect(ends[0].force[1]).toBeCloseTo(-ends[1].force[1], 9);
    }
  });

  it("el nudo cargado recibe de las barras exactamente lo que la carga le pone", () => {
    const { system } = seedTruss();
    const { equilibrium } = system.solve();

    // v3 es libre: sin reacción, las barras tienen que devolver la carga
    // cambiada de signo. Es el método de los nudos escrito como aserción.
    const v3 = equilibrium.nodes.find((n) => n.nodeId === "v3")!;
    expect(v3.applied).toEqual([4.8, -6.4]);
    expect(v3.reaction).toEqual([0, 0]);
    expect(v3.fromElements[0]).toBeCloseTo(-4.8, 9);
    expect(v3.fromElements[1]).toBeCloseTo(6.4, 9);
  });

  it("un desplazamiento falseado rompe el control", () => {
    const { system, elements, appliedForces } = seedTruss();
    const solved = system.solve();

    // El control se corre a mano con un desplazamiento cambiado: si igual
    // diera "ok", no estaría comprobando nada. Es el equivalente a un error de
    // ensamblaje o de mapeo de grados de libertad, que es lo que este control
    // existe para atrapar.
    const falseadas = new Map(solved.displacements);
    falseadas.set("v3", [solved.displacements.get("v3")![0] * 2, solved.displacements.get("v3")![1]]);

    const check = equilibriumCheck({
      dofPerNode: 2,
      nodeIds: ["v1", "v2", "v3", "v4"],
      elements,
      displacements: falseadas,
      appliedForces,
      reactions: solved.reactions,
    });

    expect(check.ok).toBe(false);
    expect(check.maxResidual).toBeGreaterThan(1);
  });

  it("sirve para cualquier sistema, no solo armaduras (1 DOF por nudo)", () => {
    // La función no sabe qué elemento es: pide `stiffness()` y los
    // desplazamientos, que es lo que declara la interfaz `Element`. Por eso el
    // día que se propague a `/springs` o `/frame2d` no hay motor que tocar.
    const system = new System(1);
    system.addNode({ id: "n1", restrained: [true] });
    system.addNode({ id: "n2", restrained: [false], force: [10] });
    system.addElement(new SpringElement("k1", ["n1", "n2"], 100));

    const { equilibrium } = system.solve();

    expect(equilibrium.ok).toBe(true);
    expect(equilibrium.nodes).toHaveLength(2);
    expect(equilibrium.nodes[1].fromElements[0]).toBeCloseTo(-10, 9);
    expect(equilibrium.global[0]).toBeCloseTo(0, 9);
  });
});
