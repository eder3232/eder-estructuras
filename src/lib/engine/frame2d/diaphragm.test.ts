import { describe, expect, it } from "vitest";
import { System } from "../system";
import { FrameElement2D, type FrameInternalForce } from "./frame-element-2d";

/**
 * El diafragma rígido (`System.addDiaphragm`): los nudos de un piso comparten
 * su desplazamiento en x. Ver `docs/frame2d-seismic-v1.md`, sección 5.
 *
 * El pórtico es el de la regresión de `system.test.ts`: un vano de 5, columnas
 * de 3.5 empotradas, y la carga horizontal de 5 en el nudo superior derecho.
 */
const E = 15000 * Math.sqrt(210) * 10;
const COLUMN = { area: 0.3 * 0.3, inertia: (0.3 * 0.3 ** 3) / 12 };
const BEAM = { area: 0.3 * 0.5, inertia: (0.3 * 0.5 ** 3) / 12 };
const H = 3.5;

const points = {
  v1: { id: "v1", x: 0, z: 0 },
  v2: { id: "v2", x: 0, z: H },
  v3: { id: "v3", x: 5, z: H },
  v4: { id: "v4", x: 5, z: 0 },
};

function portal({
  beam = BEAM,
  column = COLUMN,
  diaphragm = false,
  forces = { v2: [0, 0, 0], v3: [5, 0, 0] } as Record<"v2" | "v3", number[]>,
} = {}) {
  const system = new System(3);
  system.addNode({ id: "v1", restrained: [true, true, true], dofNumbers: [7, 8, 9] });
  system.addNode({ id: "v2", restrained: [false, false, false], force: forces.v2, dofNumbers: [1, 2, 3] });
  system.addNode({ id: "v3", restrained: [false, false, false], force: forces.v3, dofNumbers: [4, 5, 6] });
  system.addNode({ id: "v4", restrained: [true, true, true], dofNumbers: [10, 11, 12] });
  system.addElement(new FrameElement2D("e1", points.v1, points.v2, column.area, E, column.inertia));
  system.addElement(new FrameElement2D("e2", points.v2, points.v3, beam.area, E, beam.inertia));
  system.addElement(new FrameElement2D("e3", points.v3, points.v4, column.area, E, column.inertia));
  if (diaphragm) system.addDiaphragm({ id: "piso 1", nodeIds: ["v2", "v3"], localDof: 0 });
  return system;
}

const forces = (result: ReturnType<System["solve"]>, id: string) =>
  result.internalForces.get(id) as FrameInternalForce;

describe("System — diafragma rígido", () => {
  it("los nudos del piso se desplazan lo mismo en x, y K pierde un grado de libertad", () => {
    const result = portal({ diaphragm: true }).solve();
    const [u2] = result.displacements.get("v2")!;
    const [u3] = result.displacements.get("v3")!;

    expect(u2).toBe(u3);
    expect(result.assembly.globalStiffness).toHaveLength(11);
    expect(result.assembly.partition.free).toHaveLength(5);

    const shared = result.assembly.dofOrder.filter((entry) => entry.diaphragmId);
    expect(shared).toEqual([{ nodeId: "v2", localDof: 0, globalIndex: 3, restrained: false, diaphragmId: "piso 1" }]);
  });

  it("da lo mismo que una viga que no se acorta (área muy grande)", () => {
    const tied = portal({ diaphragm: true }).solve();
    const stiffBeam = portal({ beam: { area: BEAM.area * 1e6, inertia: BEAM.inertia } }).solve();

    for (const id of ["v2", "v3"]) {
      tied.displacements.get(id)!.forEach((value, i) => {
        expect(value).toBeCloseTo(stiffBeam.displacements.get(id)![i], 9);
      });
    }
    for (const id of ["v1", "v4"]) {
      tied.reactions.get(id)!.forEach((value, i) => {
        expect(value).toBeCloseTo(stiffBeam.reactions.get(id)![i], 5);
      });
    }
  });

  it("con viga rígida, la rigidez lateral del portal es la de dos columnas biempotradas: 24EI/h³", () => {
    // Rígida respecto de las columnas, no absurda: con I = 10⁶ las filas de
    // las columnas quedan en el ruido de las de la viga y el motor lo lee,
    // con razón, como un mecanismo.
    const rigid = { area: BEAM.area, inertia: COLUMN.inertia * 1e5 };
    // 24EI/h³ supone además columnas que **no se acortan**. Con las reales el
    // portal da un 0.36% más flexible: es lo que se inclina por la deformación
    // axial de las columnas, no un error.
    const column = { area: COLUMN.area * 1e4, inertia: COLUMN.inertia };
    const result = portal({ beam: rigid, column, diaphragm: true }).solve();
    const [u] = result.displacements.get("v2")!;
    const k = (24 * E * COLUMN.inertia) / H ** 3;

    expect(5 / u / k).toBeCloseTo(1, 4);
    // Cada columna toma la mitad del corte.
    expect(result.reactions.get("v1")![0]).toBeCloseTo(-2.5, 4);
    expect(result.reactions.get("v4")![0]).toBeCloseTo(-2.5, 4);
  });

  it("una fuerza en el piso se reparte igual sin importar a qué nudo se le aplique", () => {
    const onOne = portal({ diaphragm: true }).solve();
    const split = portal({ diaphragm: true, forces: { v2: [2, 0, 0], v3: [3, 0, 0] } }).solve();

    for (const id of ["v2", "v3"]) {
      onOne.displacements.get(id)!.forEach((value, i) => {
        expect(value).toBeCloseTo(split.displacements.get(id)![i], 12);
      });
    }
  });

  it("la viga del diafragma no se acorta: su fuerza axial no sale del análisis", () => {
    const result = portal({ diaphragm: true }).solve();
    expect(forces(result, "e2").from.axial).toBeCloseTo(0, 10);
  });

  it("el equilibrio cierra: el diafragma reparte la carga y sus fuerzas suman cero", () => {
    const { equilibrium } = portal({ diaphragm: true }).solve();

    expect(equilibrium.ok).toBe(true);
    expect(equilibrium.diaphragms).toHaveLength(1);
    const [piso] = equilibrium.diaphragms;
    expect(piso.residual).toBeCloseTo(0, 9);

    // La carga está en v3; el diafragma se lleva una parte a v2 —la que baja
    // por la columna izquierda— y se la saca a v3.
    const v2 = piso.forces.find((f) => f.nodeId === "v2")!.force;
    const v3 = piso.forces.find((f) => f.nodeId === "v3")!.force;
    expect(v2).toBeGreaterThan(0);
    expect(v3).toBeCloseTo(-v2, 9);
    for (const node of equilibrium.nodes) {
      for (const value of node.residual) expect(Math.abs(value)).toBeLessThan(1e-9);
    }
  });

  it("sin diafragma, el equilibrio no lista ninguno y los nudos no traen la fuerza del diafragma", () => {
    const { equilibrium } = portal().solve();
    expect(equilibrium.diaphragms).toEqual([]);
    expect(equilibrium.nodes.every((n) => n.diaphragm === undefined)).toBe(true);
  });

  it("respeta los dos criterios de orden: el índice compartido es uno solo en cualquiera", () => {
    for (const options of [{ restrainedFirst: true }, { useDofNumbers: true }]) {
      const result = portal({ diaphragm: true }).solve(options);
      const [u2] = result.displacements.get("v2")!;
      const [u3] = result.displacements.get("v3")!;
      expect(u2).toBe(u3);
      expect(result.assembly.dofOrder.map((e) => e.globalIndex)).toEqual([...Array(11).keys()]);
      expect(result.equilibrium.ok).toBe(true);
    }
  });

  it("rechaza lo que no es un diafragma", () => {
    const system = portal();
    expect(() => system.addDiaphragm({ id: "a", nodeIds: ["v2"], localDof: 0 })).toThrow(/al menos dos/);
    expect(() => system.addDiaphragm({ id: "a", nodeIds: ["v2", "v2"], localDof: 0 })).toThrow(/repite/);
    expect(() => system.addDiaphragm({ id: "a", nodeIds: ["v2", "v9"], localDof: 0 })).toThrow(/no existe/);
    expect(() => system.addDiaphragm({ id: "a", nodeIds: ["v1", "v2"], localDof: 0 })).toThrow(/restringido/);
    expect(() => system.addDiaphragm({ id: "a", nodeIds: ["v2", "v3"], localDof: 3 })).toThrow(/no existe/);

    system.addDiaphragm({ id: "a", nodeIds: ["v2", "v3"], localDof: 0 });
    expect(() => system.addDiaphragm({ id: "a", nodeIds: ["v2", "v3"], localDof: 1 })).toThrow(/ya existe/);
    expect(() => system.addDiaphragm({ id: "b", nodeIds: ["v3", "v2"], localDof: 0 })).toThrow(/ya está/);
  });
});
