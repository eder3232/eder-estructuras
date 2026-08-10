import type { FrameInternalForce, SolveResult } from "@/lib/engine";
import { DeformedDiagram } from "@/components/custom/diagram-2d/deformed-diagram";
import type { DiagramForce } from "@/components/custom/diagram-2d/types";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";

interface DeformedShapeProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
  solved: SolveResult;
}

export function DeformedShape({ elements, nodesById, solved }: DeformedShapeProps) {
  const nodes = [...nodesById.values()];

  // El diagrama solo mueve nudos: el giro no desplaza el nudo, se ve en el
  // momento de las barras que concurren en él (tabla de fuerzas internas).
  const displacements = new Map<string, [number, number]>(
    nodes.map((n) => {
      const [dx, dz] = solved.displacements.get(n.id) ?? [0, 0];
      return [n.id, [dx, dz]];
    }),
  );

  const reactions: DiagramForce[] = [];
  for (const n of nodes) {
    const [rx, rz, mr] = solved.reactions.get(n.id) ?? [0, 0, 0];
    if (n.restrainedX) reactions.push({ nodeId: n.id, x: n.x, z: n.z, axis: "x", value: rx });
    if (n.restrainedZ) reactions.push({ nodeId: n.id, x: n.x, z: n.z, axis: "z", value: rz });
    if (n.restrainedR) reactions.push({ nodeId: n.id, x: n.x, z: n.z, axis: "r", value: mr });
  }

  /**
   * El color de la barra sigue siendo la fuerza axial, igual que en armaduras
   * 2D: es el único de los tres esfuerzos que es un solo número con signo
   * constante a lo largo de la barra (el momento varía punto a punto, colorear
   * por él daría una lectura falsa). Se toma el extremo j, donde el signo
   * positivo significa tracción.
   */
  const elementForceValue = new Map(
    elements.map((e) => [e.id, (solved.internalForces.get(e.id) as FrameInternalForce | undefined)?.to.axial ?? 0]),
  );

  return (
    <DeformedDiagram
      nodes={nodes}
      elements={elements}
      displacements={displacements}
      reactions={reactions}
      elementForceValue={elementForceValue}
    />
  );
}
