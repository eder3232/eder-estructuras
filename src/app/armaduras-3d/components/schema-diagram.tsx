"use client";

import dynamic from "next/dynamic";
import { useAtom } from "jotai";

import type { Diagram3DForce, Diagram3DSupport } from "@/components/custom/diagram-3d/types";
import { atomNodes, nodeAxes, forceFieldByAxis, restrainedFieldByAxis } from "../store/nodes";
import { atomElements } from "../store/elements";

/**
 * La escena arranca WebGL al montarse, así que no tiene nada que hacer en el
 * render del servidor: se carga solo en el cliente (`ssr: false`, permitido acá
 * porque este archivo ya es un Client Component).
 */
const SchemaScene = dynamic(
  () => import("@/components/custom/diagram-3d/schema-scene").then((m) => m.SchemaScene),
  { ssr: false, loading: () => <SceneSkeleton /> },
);

function SceneSkeleton() {
  return (
    <div className="flex h-[28rem] w-full items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
      Cargando escena…
    </div>
  );
}

export function SchemaDiagram() {
  const [nodes] = useAtom(atomNodes);
  const [elements] = useAtom(atomElements);

  const supports: Diagram3DSupport[] = nodes
    .filter((n) => n.restrainedX || n.restrainedY || n.restrainedZ)
    .map((n) => ({
      nodeId: n.id,
      x: n.x,
      y: n.y,
      z: n.z,
      restrainedX: n.restrainedX,
      restrainedY: n.restrainedY,
      restrainedZ: n.restrainedZ,
    }));

  const forces: Diagram3DForce[] = [];
  for (const node of nodes) {
    for (const axis of nodeAxes) {
      if (node[restrainedFieldByAxis[axis]]) continue;
      const value = node[forceFieldByAxis[axis]];
      if (value !== 0) forces.push({ nodeId: node.id, x: node.x, y: node.y, z: node.z, axis, value });
    }
  }

  return <SchemaScene nodes={nodes} elements={elements} supports={supports} forces={forces} />;
}
