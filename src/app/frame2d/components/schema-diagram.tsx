"use client";

import { useAtom } from "jotai";

import { SchemaDiagram as GenericSchemaDiagram } from "@/components/custom/diagram-2d/schema-diagram";
import type { DiagramForce, DiagramMemberLoad, DiagramSupport } from "@/components/custom/diagram-2d/types";
import { lengthFactor, memberAxis } from "@/lib/engine";
import { atomNodes } from "../store/nodes";
import { atomElements } from "../store/elements";
import { atomLoads, toMemberLoad } from "../store/loads";

export function SchemaDiagram() {
  const [nodes] = useAtom(atomNodes);
  const [elements] = useAtom(atomElements);
  const [loads] = useAtom(atomLoads);

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

  // El diagrama recibe la dirección ya en ejes globales y la intensidad **por
  // metro de barra**: una carga por proyección se dibuja —flechas y número—
  // con lo que de verdad le llega a la barra, para que el dibujo y el número
  // digan lo mismo. Lo escrito por el alumno sigue a la vista en la tabla.
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const memberLoads = loads.flatMap<DiagramMemberLoad>((load) => {
    const element = elements.find((e) => e.id === load.elementId);
    const from = element && nodesById.get(element.fromNodeId);
    const to = element && nodesById.get(element.toNodeId);
    if (!element || !from || !to) return [];
    const axis = memberAxis(from, to);
    const member = toMemberLoad(load, axis.length);
    const direction =
      member.kind === "moment"
        ? { x: 0, z: 0 }
        : {
            perpendicular: { x: -axis.sin, z: axis.cos },
            axial: { x: axis.cos, z: axis.sin },
            globalX: { x: 1, z: 0 },
            globalZ: { x: 0, z: 1 },
          }[member.direction];
    if (member.kind === "distributed") {
      const factor = lengthFactor(member, axis);
      return [
        {
          id: load.id,
          elementId: element.id,
          kind: "distributed",
          direction,
          q1: member.q1 * factor,
          q2: member.q2 * factor,
          a: member.a,
          b: member.b,
        },
      ];
    }
    return [{ id: load.id, elementId: element.id, kind: member.kind, direction, q1: member.value, q2: 0, a: member.a, b: member.a }];
  });

  return (
    <GenericSchemaDiagram
      nodes={nodes}
      elements={elements}
      supports={supports}
      forces={forces}
      memberLoads={memberLoads}
    />
  );
}
