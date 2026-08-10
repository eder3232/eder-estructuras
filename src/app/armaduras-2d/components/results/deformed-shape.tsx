import type { SolveResult, TrussInternalForce } from "@/lib/engine";
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

  const displacements = new Map<string, [number, number]>(
    nodes.map((n) => {
      const [dx, dz] = solved.displacements.get(n.id) ?? [0, 0];
      return [n.id, [dx, dz]];
    }),
  );

  const reactions: DiagramForce[] = [];
  for (const n of nodes) {
    const [rx, rz] = solved.reactions.get(n.id) ?? [0, 0];
    if (n.restrainedX) reactions.push({ nodeId: n.id, x: n.x, z: n.z, axis: "x", value: rx });
    if (n.restrainedZ) reactions.push({ nodeId: n.id, x: n.x, z: n.z, axis: "z", value: rz });
  }

  const elementForceValue = new Map(
    elements.map((e) => [e.id, (solved.internalForces.get(e.id) as TrussInternalForce | undefined)?.axialForce ?? 0]),
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
