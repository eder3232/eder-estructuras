import { atom } from "jotai";
import {
  FrameElement2D,
  SingularStiffnessError,
  System,
  loadFixedEndForces,
  memberAxis,
  memberDeflection,
  memberDiagram,
  sumFixedEndForces,
  type FrameFixedEndForces,
  type FrameInternalForce,
  type MemberAxis,
  type DeflectionPoint,
  type MemberDiagram,
  type MemberLoad,
  type SolveResult,
  type SolveWarning,
} from "@/lib/engine";
import { atomNodes, type NodeRow } from "./nodes";
import { atomElements, type ElementRow } from "./elements";
import { atomLoads, toMemberLoad, type LoadRow } from "./loads";

import type { DomainError, DomainIssue } from "@/components/custom/errors-panel";
import { displayNames, withDisplayNames } from "@/lib/display-names";

/** Los mismos tres estados que `/armaduras-2d`: ver allá el porqué de cada uno. */
export type Frame2DResults =
  | { status: "ok"; solved: SolveResult; warnings: DomainIssue[]; nodesById: Map<string, NodeRow> }
  | { status: "error"; errors: DomainError[]; nodesById: Map<string, NodeRow> }
  | {
      status: "empty";
      reason: "no-nodes" | "no-elements";
      nodeCount: number;
      nodesById: Map<string, NodeRow>;
    };

/** Le pone nombre a lo que el motor solo sabe señalar por id. */
function toIssues(
  warnings: SolveWarning[],
  nodesById: Map<string, NodeRow>,
  elements: ElementRow[],
): DomainIssue[] {
  return warnings.map((warning) => ({
    ...warning,
    severity: "warning" as const,
    refName:
      warning.source === "node"
        ? nodesById.get(warning.refId)?.name
        : warning.source === "element"
          ? elements.find((e) => e.id === warning.refId)?.name
          : undefined,
  }));
}

function manualFixedEndForces(element: ElementRow): FrameFixedEndForces {
  return {
    from: { axial: element.femAxialFrom, shear: element.femShearFrom, moment: element.femMomentFrom },
    to: { axial: element.femAxialTo, shear: element.femShearTo, moment: element.femMomentTo },
  };
}

/**
 * El FEM de cada barra y lo que haya que decir de las cargas.
 *
 * Una carga que no se puede usar **no frena el cálculo de las demás filas**
 * pero sí el del modelo: un FEM con una carga a medio escribir no significa
 * nada, y resolver igual mostraría números de una estructura que no es la que
 * el alumno cargó.
 */
function fixedEndForcesByElement(
  elements: ElementRow[],
  loads: LoadRow[],
  nodesById: Map<string, NodeRow>,
): {
  fem: Map<string, FrameFixedEndForces>;
  /** Barras con alguna carga que no se pudo usar: su FEM no significa nada. */
  brokenElementIds: Set<string>;
  /** Las cargas de cada barra ya traducidas al motor, y su eje: con eso se dibujan los diagramas. */
  loadsByElement: Map<string, MemberLoad[]>;
  axisByElement: Map<string, MemberAxis>;
  errors: DomainError[];
  warnings: DomainIssue[];
} {
  const errors: DomainError[] = [];
  const brokenElementIds = new Set<string>();
  const warnings: DomainIssue[] = [];
  const perElement = new Map<string, FrameFixedEndForces[]>();
  const loadsByElement = new Map<string, MemberLoad[]>();
  const axisByElement = new Map<string, MemberAxis>();
  for (const element of elements) {
    const from = nodesById.get(element.fromNodeId);
    const to = nodesById.get(element.toNodeId);
    if (from && to) axisByElement.set(element.id, memberAxis(from, to));
  }
  const elementsById = new Map(elements.map((e) => [e.id, e]));

  for (const load of loads) {
    const issue = (message: string) => ({ source: "load" as const, refId: load.id, refName: load.name, message });
    const element = elementsById.get(load.elementId);
    if (!element) {
      errors.push({
        ...issue(load.elementId ? "Está en una barra que ya no existe." : "No tiene barra: elegí en cuál está."),
        severity: "error",
      });
      continue;
    }
    if (element.manualFem) {
      warnings.push({
        ...issue(
          `No se usa: la barra ${element.name} tiene el FEM escrito a mano, que reemplaza a sus cargas. ` +
            `Si querés que cuente, apagá «FEM a mano» en esa barra.`,
        ),
        severity: "warning",
      });
      continue;
    }
    const from = nodesById.get(element.fromNodeId);
    const to = nodesById.get(element.toNodeId);
    // Sin los dos nudos la barra ya está en error por su lado; no hay L con qué medir la carga.
    if (!from || !to) continue;

    const axis = memberAxis(from, to);
    try {
      const member = toMemberLoad(load, axis.length);
      const fem = loadFixedEndForces(member, axis);
      perElement.set(element.id, [...(perElement.get(element.id) ?? []), fem]);
      loadsByElement.set(element.id, [...(loadsByElement.get(element.id) ?? []), member]);
    } catch (e) {
      errors.push({ ...issue(e instanceof Error ? e.message : String(e)), severity: "error" });
      brokenElementIds.add(element.id);
    }
  }

  const fem = new Map(
    elements.map((element) => [
      element.id,
      element.manualFem ? manualFixedEndForces(element) : sumFixedEndForces(perElement.get(element.id) ?? []),
    ]),
  );
  return { fem, brokenElementIds, loadsByElement, axisByElement, errors, warnings };
}

/** El FEM de cada barra, calculado o a mano: lo leen el cálculo y la tabla «FEM por barra». */
export const atomMemberLoads = atom((get) => {
  const nodes = get(atomNodes);
  return fixedEndForcesByElement(get(atomElements), get(atomLoads), new Map(nodes.map((n) => [n.id, n])));
});

export const atomResults = atom<Frame2DResults>((get) => {
  const nodes = get(atomNodes);
  const elements = get(atomElements);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Sin barras no hay nada que resolver, y no un mecanismo; sin nudos, el motor
  // devolvía un "resuelto" vacío (B4 de docs/frame2d-v1.md).
  if (nodes.length === 0 || elements.length === 0) {
    return {
      status: "empty",
      reason: nodes.length === 0 ? "no-nodes" : "no-elements",
      nodeCount: nodes.length,
      nodesById,
    };
  }

  const system = new System(3);
  const memberLoads = get(atomMemberLoads);
  const errors: DomainError[] = [...memberLoads.errors];
  // Los mensajes del motor nombran ids; acá se cambian por lo que ve el alumno (B2).
  const names = displayNames(nodes, elements);

  for (const node of nodes) {
    try {
      system.addNode({
        id: node.id,
        restrained: [node.restrainedX, node.restrainedZ, node.restrainedR],
        force: [node.forceX, node.forceZ, node.momentR],
        displacement: [node.displacementX, node.displacementZ, node.displacementR],
      });
    } catch (e) {
      errors.push({
        source: "node",
        refId: node.id,
        refName: node.name,
        severity: "error",
        message: withDisplayNames(e instanceof Error ? e.message : String(e), names),
      });
    }
  }

  for (const element of elements) {
    try {
      const from = nodesById.get(element.fromNodeId);
      const to = nodesById.get(element.toNodeId);
      if (!from || !to) {
        throw new Error(`El elemento ${element.name} referencia un nudo inexistente.`);
      }
      system.addElement(
        new FrameElement2D(
          element.id,
          { id: from.id, x: from.x, z: from.z },
          { id: to.id, x: to.x, z: to.z },
          element.area,
          element.elasticity,
          element.inertia,
          memberLoads.fem.get(element.id),
        ),
      );
    } catch (e) {
      errors.push({
        source: "element",
        refId: element.id,
        refName: element.name,
        severity: "error",
        message: withDisplayNames(e instanceof Error ? e.message : String(e), names),
      });
    }
  }

  if (errors.length > 0) {
    return { status: "error", errors, nodesById };
  }

  try {
    const solved = system.solve();
    return {
      status: "ok",
      solved,
      warnings: [...memberLoads.warnings, ...toIssues(solved.warnings, nodesById, elements)],
      nodesById,
    };
  } catch (e) {
    return {
      status: "error",
      errors: [
        {
          severity: "error",
          source: "element",
          refId: "-",
          message: withDisplayNames(e instanceof Error ? e.message : String(e), names),
          mechanism: e instanceof SingularStiffnessError ? e.diagnosis : undefined,
        },
      ],
      nodesById,
    };
  }
});

/**
 * Los diagramas N, V, M de cada barra, o la razón por la que no los hay.
 *
 * Una barra con **FEM a mano** no tiene diagramas interiores: el FEM escrito no
 * dice cómo está repartida la carga, y sin eso no hay con qué dibujar entre los
 * extremos. El original los dibujaba igual, como si la barra no tuviera carga
 * (V13 de `docs/frame2d-v1.md`); acá se dice.
 */
export type MemberDiagramResult = { status: "ok"; diagram: MemberDiagram } | { status: "manual-fem" };

export const atomMemberDiagrams = atom((get) => {
  const results = get(atomResults);
  const diagrams = new Map<string, MemberDiagramResult>();
  if (results.status !== "ok") return diagrams;

  const { loadsByElement, axisByElement } = get(atomMemberLoads);
  for (const element of get(atomElements)) {
    if (element.manualFem) {
      diagrams.set(element.id, { status: "manual-fem" });
      continue;
    }
    const forces = results.solved.internalForces.get(element.id) as FrameInternalForce | undefined;
    const axis = axisByElement.get(element.id);
    if (!forces || !axis) continue;
    diagrams.set(element.id, {
      status: "ok",
      diagram: memberDiagram(forces, loadsByElement.get(element.id) ?? [], axis),
    });
  }
  return diagrams;
});

/**
 * La forma deformada de cada barra, entre sus nudos (D3): en ejes locales,
 * `u` sobre la barra y `v` perpendicular. Ver `memberDeflection`.
 *
 * Una barra con **FEM a mano** se curva solo por lo que hacen sus extremos
 * (`homogeneousOnly`): sin saber cómo está repartida su carga no hay flecha
 * propia que sumarle. La deformada lo dice en su leyenda.
 */
export interface MemberShape {
  points: DeflectionPoint[];
  axis: MemberAxis;
  homogeneousOnly: boolean;
}

export const atomMemberShapes = atom((get) => {
  const results = get(atomResults);
  const shapes = new Map<string, MemberShape>();
  if (results.status !== "ok") return shapes;

  const { loadsByElement, axisByElement, fem } = get(atomMemberLoads);
  for (const element of get(atomElements)) {
    const axis = axisByElement.get(element.id);
    const from = results.solved.displacements.get(element.fromNodeId);
    const to = results.solved.displacements.get(element.toNodeId);
    if (!axis || !from || !to) continue;
    const { cos: c, sin: s } = axis;
    // T · u_global, extremo por extremo: la rotación no cambia.
    const local = (d: number[]) => [c * d[0] + s * d[1], -s * d[0] + c * d[1], d[2]];
    const zero = { from: { axial: 0, shear: 0, moment: 0 }, to: { axial: 0, shear: 0, moment: 0 } };
    const { points } = memberDeflection({
      axis,
      localEnds: [...local(from), ...local(to)],
      fixedEndForces: element.manualFem ? zero : (fem.get(element.id) ?? zero),
      loads: element.manualFem ? [] : (loadsByElement.get(element.id) ?? []),
      ea: element.elasticity * element.area,
      ei: element.elasticity * element.inertia,
    });
    shapes.set(element.id, { points, axis, homogeneousOnly: element.manualFem });
  }
  return shapes;
});
