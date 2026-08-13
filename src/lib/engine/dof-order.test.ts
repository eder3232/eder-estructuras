import { describe, expect, it } from "vitest";
import { System } from "./system";
import { TrussElement2D } from "./trusses-2d/truss-element-2d";

/**
 * El orden de los grados de libertad es configurable porque cada profesor
 * ensambla la matriz global a su manera: unos ponen los restringidos arriba y
 * otros abajo (ver `docs/pendientes-comparacion.md`, grupo M).
 *
 * Lo que estos tests fijan es la mitad que importa: **que sea solo una
 * permutación**. Si los desplazamientos, las reacciones o los esfuerzos
 * cambiaran con el orden, el cambio no sería de presentación sino un bug de
 * física — y sería silencioso, porque los números seguirían pareciendo
 * plausibles.
 */

/** La armadura del test de regresión, que es también la semilla de la página. */
function armadura() {
  const area = 10 * 10 ** -4;
  const elasticity = 2 * 10 ** 7;
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

  system.addElement(new TrussElement2D("e1", points.v1, points.v2, area, elasticity));
  system.addElement(new TrussElement2D("e2", points.v3, points.v4, area, elasticity));
  system.addElement(new TrussElement2D("e3", points.v1, points.v3, area, elasticity));
  system.addElement(new TrussElement2D("e4", points.v2, points.v4, area, elasticity));
  system.addElement(new TrussElement2D("e5", points.v1, points.v4, area, elasticity));
  system.addElement(new TrussElement2D("e6", points.v2, points.v3, area, elasticity));
  return system;
}

describe("orden de los grados de libertad", () => {
  it("por defecto numera por orden de inserción, como siempre", () => {
    const { assembly } = armadura().solve();

    expect(assembly.restrainedFirst).toBe(false);
    expect(assembly.dofOrder.map((d) => `${d.nodeId}${d.localDof}`)).toEqual([
      "v10", "v11", "v20", "v21", "v30", "v31", "v40", "v41",
    ]);
    expect(assembly.partition.free).toEqual([4, 5, 6, 7]);
    expect(assembly.partition.restrained).toEqual([0, 1, 2, 3]);
  });

  it("con los restringidos arriba, cambian los índices y no el orden dentro de cada grupo", () => {
    const { assembly } = armadura().solve({ restrainedFirst: true });

    expect(assembly.restrainedFirst).toBe(true);
    // v1 y v2 están restringidos y v3/v4 libres, así que en esta armadura el
    // orden de las etiquetas no se mueve — lo que se mueve es el criterio.
    // Lo que sí hay que ver es que los grupos quedaron contiguos y en su lugar.
    expect(assembly.partition.restrained).toEqual([0, 1, 2, 3]);
    expect(assembly.partition.free).toEqual([4, 5, 6, 7]);
  });

  it("`dofOrder[i]` es la fila `i` de la matriz, en los dos órdenes", () => {
    for (const restrainedFirst of [false, true]) {
      const { assembly } = armadura().solve({ restrainedFirst });

      // De esta invariante dependen las etiquetas de **todas** las matrices de
      // la pantalla. `dofOrder` se arma recorriendo los nudos, así que sin un
      // sort explícito sale en orden de inserción y las etiquetas quedan
      // corridas sin que nada falle.
      assembly.dofOrder.forEach((entry, i) => expect(entry.globalIndex).toBe(i));
    }
  });

  it("los resultados son idénticos: es una permutación, no otra física", () => {
    const base = armadura().solve();
    const flipped = armadura().solve({ restrainedFirst: true });

    for (const id of ["v1", "v2", "v3", "v4"]) {
      expect(flipped.displacements.get(id)).toEqual(base.displacements.get(id));
      expect(flipped.reactions.get(id)).toEqual(base.reactions.get(id));
    }
    for (const id of ["e1", "e2", "e3", "e4", "e5", "e6"]) {
      expect(flipped.internalForces.get(id)).toEqual(base.internalForces.get(id));
    }
  });

  it("si el alumno numeró, manda su numeración — aunque mezcle los grupos", () => {
    const area = 10 * 10 ** -4;
    const elasticity = 2 * 10 ** 7;
    const system = new System(2);
    // Una numeración "rara" a propósito, de las que pone el profesor para ver
    // si el alumno entendió: v3 primero, y los ejes de v1 separados.
    system.addNode({ id: "v1", restrained: [true, true], dofNumbers: [3, 6] });
    system.addNode({ id: "v2", restrained: [true, true], dofNumbers: [4, 5] });
    system.addNode({ id: "v3", restrained: [false, false], force: [1, -2], dofNumbers: [1, 2] });
    system.addElement(
      new TrussElement2D("e1", { id: "v1", x: 0, z: 0 }, { id: "v3", x: 0, z: 4 }, area, elasticity),
    );
    system.addElement(
      new TrussElement2D("e2", { id: "v2", x: 3, z: 0 }, { id: "v3", x: 0, z: 4 }, area, elasticity),
    );

    const { assembly } = system.solve({ useDofNumbers: true });

    // Exactamente lo pedido: los libres (v3) arriba, y v1z al final, entre
    // medio de los otros restringidos. **El original no podía hacer esto**:
    // cortaba la matriz por posición, así que forzaba los dos grupos contiguos.
    expect(assembly.dofOrder.map((d) => `${d.nodeId}${d.localDof}`)).toEqual([
      "v30", "v31", "v10", "v20", "v21", "v11",
    ]);
  });

  it("numerar tampoco cambia los resultados", () => {
    const area = 10 * 10 ** -4;
    const elasticity = 2 * 10 ** 7;
    const build = (dofNumbers: boolean) => {
      const system = new System(2);
      system.addNode({ id: "v1", restrained: [true, true], dofNumbers: dofNumbers ? [3, 6] : undefined });
      system.addNode({ id: "v2", restrained: [true, true], dofNumbers: dofNumbers ? [4, 5] : undefined });
      system.addNode({
        id: "v3",
        restrained: [false, false],
        force: [1, -2],
        dofNumbers: dofNumbers ? [1, 2] : undefined,
      });
      system.addElement(
        new TrussElement2D("e1", { id: "v1", x: 0, z: 0 }, { id: "v3", x: 0, z: 4 }, area, elasticity),
      );
      system.addElement(
        new TrussElement2D("e2", { id: "v2", x: 3, z: 0 }, { id: "v3", x: 0, z: 4 }, area, elasticity),
      );
      return system.solve(dofNumbers ? { useDofNumbers: true } : {});
    };

    const base = build(false);
    const numerado = build(true);

    for (const id of ["v1", "v2", "v3"]) {
      expect(numerado.displacements.get(id)).toEqual(base.displacements.get(id));
      expect(numerado.reactions.get(id)).toEqual(base.reactions.get(id));
    }
  });

  it("avisa —sin bloquear— si la numeración tiene repetidos o saltos", () => {
    const area = 10 * 10 ** -4;
    const elasticity = 2 * 10 ** 7;
    const system = new System(2);
    system.addNode({ id: "v1", restrained: [true, true], dofNumbers: [1, 1] });
    system.addNode({ id: "v2", restrained: [true, true], dofNumbers: [3, 4] });
    system.addNode({ id: "v3", restrained: [false, false], force: [1, -2], dofNumbers: [5, 6] });
    system.addElement(
      new TrussElement2D("e1", { id: "v1", x: 0, z: 0 }, { id: "v3", x: 0, z: 4 }, area, elasticity),
    );
    system.addElement(
      new TrussElement2D("e2", { id: "v2", x: 3, z: 0 }, { id: "v3", x: 0, z: 4 }, area, elasticity),
    );

    const solved = system.solve({ useDofNumbers: true });

    expect(solved.warnings.map((w) => w.code)).toContain("dof-order-adjusted");
    // Y sigue habiendo resultados: es una advertencia, no un error.
    expect(solved.displacements.get("v3")).toBeDefined();
  });

  it("con un modelo donde los grupos se intercalan, el reordenamiento se nota", () => {
    // v1 libre, v2 restringido, v3 libre: en orden de inserción los grupos
    // quedan mezclados, que es el caso donde el toggle hace algo visible.
    const area = 10 * 10 ** -4;
    const elasticity = 2 * 10 ** 7;
    const system = new System(2);
    system.addNode({ id: "v1", restrained: [false, false], force: [0, -5] });
    system.addNode({ id: "v2", restrained: [true, true] });
    system.addNode({ id: "v3", restrained: [true, true] });
    system.addElement(
      new TrussElement2D("e1", { id: "v1", x: 0, z: 0 }, { id: "v2", x: 3, z: 0 }, area, elasticity),
    );
    system.addElement(
      new TrussElement2D("e2", { id: "v1", x: 0, z: 0 }, { id: "v3", x: 0, z: 4 }, area, elasticity),
    );

    const etiquetas = (restrainedFirst: boolean) =>
      system.solve({ restrainedFirst }).assembly.dofOrder.map((d) => `${d.nodeId}${d.localDof}`);

    expect(etiquetas(false)).toEqual(["v10", "v11", "v20", "v21", "v30", "v31"]);
    expect(etiquetas(true)).toEqual(["v20", "v21", "v30", "v31", "v10", "v11"]);
  });
});
