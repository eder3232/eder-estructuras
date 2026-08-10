"use client";

import { useAtom } from "jotai";

import { SchemaDiagram as GenericSchemaDiagram } from "@/components/custom/diagram-2d/schema-diagram";
import type { DiagramForce, DiagramSupport } from "@/components/custom/diagram-2d/types";
import { atomNodes } from "../store/nodes";
import { atomElements } from "../store/elements";

export function SchemaDiagram() {
  const [nodes] = useAtom(atomNodes);
  const [elements] = useAtom(atomElements);

  const supports: DiagramSupport[] = nodes
    .filter((n) => n.restrainedX || n.restrainedZ || n.restrainedR)
    .map((n) => ({
      nodeId: n.id,
      x: n.x,
      z: n.z,
      restrainedX: n.restrainedX,
      restrainedZ: n.restrainedZ,
      restrainedRotation: n.restrainedR,
    }));

  const forces: DiagramForce[] = [];
  for (const n of nodes) {
    if (n.forceX !== 0) forces.push({ nodeId: n.id, x: n.x, z: n.z, axis: "x", value: n.forceX });
    if (n.forceZ !== 0) forces.push({ nodeId: n.id, x: n.x, z: n.z, axis: "z", value: n.forceZ });
    if (n.momentR !== 0) forces.push({ nodeId: n.id, x: n.x, z: n.z, axis: "r", value: n.momentR });
  }

  return <GenericSchemaDiagram nodes={nodes} elements={elements} supports={supports} forces={forces} />;
}
