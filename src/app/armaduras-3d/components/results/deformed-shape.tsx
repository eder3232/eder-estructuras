"use client";

import dynamic from "next/dynamic";

import type { SolveResult, Truss3DInternalForce } from "@/lib/engine";
import type { Diagram3DForce, Point3 } from "@/components/custom/diagram-3d/types";
import type { ElementRow } from "../../store/elements";
import { nodeAxes, restrainedFieldByAxis, type NodeRow } from "../../store/nodes";

const DeformedScene = dynamic(
  () => import("@/components/custom/diagram-3d/deformed-scene").then((m) => m.DeformedScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[28rem] w-full items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
        Cargando escena…
      </div>
    ),
  },
);

interface DeformedShapeProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
  solved: SolveResult;
}

export function DeformedShape({ elements, nodesById, solved }: DeformedShapeProps) {
  const nodes = [...nodesById.values()];

  const displacements = new Map<string, Point3>(
    nodes.map((n) => {
      const [dx, dy, dz] = solved.displacements.get(n.id) ?? [0, 0, 0];
      return [n.id, [dx, dy, dz]];
    }),
  );

  const reactions: Diagram3DForce[] = [];
  for (const node of nodes) {
    const solvedReactions = solved.reactions.get(node.id) ?? [0, 0, 0];
    nodeAxes.forEach((axis, index) => {
      if (!node[restrainedFieldByAxis[axis]]) return;
      reactions.push({ nodeId: node.id, x: node.x, y: node.y, z: node.z, axis, value: solvedReactions[index] });
    });
  }

  const elementForceValue = new Map(
    elements.map((e) => [
      e.id,
      (solved.internalForces.get(e.id) as Truss3DInternalForce | undefined)?.axialForce ?? 0,
    ]),
  );

  return (
    <DeformedScene
      nodes={nodes}
      elements={elements}
      displacements={displacements}
      reactions={reactions}
      elementForceValue={elementForceValue}
    />
  );
}
