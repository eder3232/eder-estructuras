"use client";

import { useAtom } from "jotai";

import { SchemaDiagram as GenericSchemaDiagram } from "@/components/custom/diagram-2d/schema-diagram";
import type { DiagramForce, DiagramMemberLoad, DiagramSupport } from "@/components/custom/diagram-2d/types";
import { useHighlight, useSetHighlight } from "@/components/custom/highlight";
import { NoResults } from "@/components/custom/no-results";
import { memberAxis } from "@/lib/engine";
import { toMemberLoad } from "../store/loads";
import { useFrame2DView } from "../frame2d-view";

export function SchemaDiagram() {
  const { atomNodes, atomElements, atomLoads } = useFrame2DView();
  const [nodes] = useAtom(atomNodes);
  const [elements] = useAtom(atomElements);
  const [loads] = useAtom(atomLoads);
  // Las dos direcciones de N3: lee lo que señalan las filas y señala lo que toca el mouse acá.
  const highlight = useHighlight();
  const setHighlight = useSetHighlight();

  // Sin nudos el diagrama genérico no dibuja nada: se dice por qué (U3).
  if (nodes.length === 0) {
    return (
      <NoResults tone="empty" title="Todavía no hay nada que dibujar">
        El esquema aparece en cuanto cargues el primer nudo.
      </NoResults>
    );
  }

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

  // El diagrama recibe la dirección ya en ejes globales y la intensidad **como
  // la escribió el alumno**. Una carga por proyección se marca «por planta»: la
  // primera versión dibujaba lo que le llega por metro de barra (8·cos α) y el
  // número del dibujo (−7.43) no aparecía en ninguna tabla.
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
      return [
        {
          id: load.id,
          elementId: element.id,
          kind: "distributed",
          direction,
          q1: member.q1,
          q2: member.q2,
          a: member.a,
          b: member.b,
          projected: member.projected,
        },
      ];
    }
    return [{ id: load.id, elementId: element.id, kind: member.kind, direction, q1: member.value, q2: 0, a: member.a, b: member.a }];
  });

  return (
    <div className="flex flex-col gap-2">
      <GenericSchemaDiagram
        nodes={nodes}
        elements={elements}
        supports={supports}
        forces={forces}
        memberLoads={memberLoads}
        highlight={highlight}
        onHighlight={setHighlight}
      />
      <p className="max-w-3xl text-xs text-muted-foreground">
        Las tablas y el dibujo son lo mismo mirado de dos formas:{" "}
        <span className="font-medium text-foreground">pasá el mouse por una fila</span> y se enciende acá, o por un
        nudo o una barra del dibujo y se enciende la fila. Una barra prende también los dos nudos que toca y las filas
        de sus cargas.
      </p>
    </div>
  );
}
