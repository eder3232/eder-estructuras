import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { atomResults } from "./results";
import { atomAddNode, atomToggleNodeRestrained, atomUpdateNodeField, seedNodeIds } from "./nodes";

/**
 * El motor ya está probado en `src/lib/engine/trusses-3d/`. Lo que se prueba
 * acá es la capa que esos tests no tocan: que el store arme los vectores de 3
 * componentes en el orden correcto. Con tres ejes de la misma magnitud física,
 * cruzar `y` con `z` en un solo mapa daría números plausibles pero incorrectos
 * y no saltaría en ninguna verificación visual.
 */
describe("atomResults de /armaduras-3d", () => {
  it("los datos semilla reproducen la regresión del motor", () => {
    const store = createStore();
    const results = store.get(atomResults);

    expect(results.status).toBe("ok");
    if (results.status !== "ok") return;

    const { displacements, reactions, internalForces } = results.solved;

    // Mismos valores que src/lib/engine/trusses-3d/system.test.ts.
    expect(displacements.get(seedNodeIds.d)![0]).toBeCloseTo(0.0064739040706, 10);
    expect(displacements.get(seedNodeIds.d)![1]).toBeCloseTo(-0.0095201104204, 10);
    expect(displacements.get(seedNodeIds.d)![2]).toBeCloseTo(-0.0012227816895, 10);

    // El asentamiento prescrito viaja hasta el eje correcto (z, no y).
    expect(displacements.get(seedNodeIds.b)![1]).toBeCloseTo(0, 12);
    expect(displacements.get(seedNodeIds.b)![2]).toBeCloseTo(-0.01, 12);

    expect(reactions.get(seedNodeIds.a)![0]).toBeCloseTo(-2.8571428571, 8);
    expect(reactions.get(seedNodeIds.a)![2]).toBeCloseTo(14.2857142857, 8);
    expect(reactions.get(seedNodeIds.c)![2]).toBeCloseTo(15, 8);

    expect((internalForces.get("seed-e6") as { axialForce: number }).axialForce).toBeCloseTo(-18.4661853126, 8);
  });

  it("una carga en `y` mueve el nudo en `y`, no en otro eje", () => {
    const store = createStore();
    // Se quita la carga vertical de la semilla y se pone uno horizontal en y.
    store.set(atomUpdateNodeField, { id: seedNodeIds.d, field: "forceZ", value: 0 });
    store.set(atomUpdateNodeField, { id: seedNodeIds.d, field: "forceY", value: 25 });

    const results = store.get(atomResults);
    expect(results.status).toBe("ok");
    if (results.status !== "ok") return;

    const [ux, uy, uz] = results.solved.displacements.get(seedNodeIds.d)!;
    expect(uy).toBeGreaterThan(0);
    expect(Math.abs(uy)).toBeGreaterThan(Math.abs(ux));
    expect(Math.abs(uy)).toBeGreaterThan(Math.abs(uz));
  });

  it("informa el error sin romper cuando el sistema queda inestable", () => {
    const store = createStore();
    // Un nudo suelto, sin ninguna barra: sus 3 DOF libres no tienen rigidez, así
    // que Kff no tiene inversa. Es el estado intermedio normal de alguien que
    // agrega un nudo antes de conectarlo — la página tiene que avisar, no romperse.
    store.set(atomAddNode);

    const results = store.get(atomResults);
    expect(results.status).toBe("error");
    if (results.status !== "error") return;
    expect(results.errors.length).toBeGreaterThan(0);
  });

  it("togglear una restricción limpia el dato incompatible en ese eje", () => {
    const store = createStore();
    // `b` tiene un asentamiento prescrito en z; al liberarlo, el desplazamiento
    // se resetea, que es lo que `System.addNode` exige.
    store.set(atomToggleNodeRestrained, { id: seedNodeIds.b, axis: "z" });

    const results = store.get(atomResults);
    expect(results.nodesById.get(seedNodeIds.b)!.displacementZ).toBe(0);
  });
});
