"use client";

import dynamic from "next/dynamic";
import { useAtom } from "jotai";

import type { Diagram3DForce, Diagram3DSupport } from "@/components/custom/diagram-3d/types";
import { useHighlight, useSetHighlight } from "@/components/custom/highlight";
import { atomNodes, nodeAxes, forceFieldByAxis, restrainedFieldByAxis } from "../store/nodes";
import { atomElements } from "../store/elements";
import { mechanismMotion } from "../store/mechanism-motion";
import { atomResults } from "../store/results";

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
  const [results] = useAtom(atomResults);
  // Las dos direcciones de N3, como en el esquema 2D: lee lo que señalan las
  // filas y señala lo que toca el mouse acá.
  const highlight = useHighlight();
  const setHighlight = useSetHighlight();

  const diagnosis = results.status === "error" ? results.errors.find((e) => e.mechanism)?.mechanism : undefined;
  const motion = diagnosis ? mechanismMotion(diagnosis) : [];

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

  return (
    <div className="flex flex-col gap-2">
      <SchemaScene
        nodes={nodes}
        elements={elements}
        supports={supports}
        forces={forces}
        highlight={highlight}
        onHighlight={setHighlight}
        motion={motion}
      />
      {motion.length > 0 && (
        // Lo que dice el dibujo, dicho una vez: sin esto, unas flechas naranjas
        // sin número se leen como cargas.
        <p className="max-w-3xl text-xs text-muted-foreground">
          <span className="font-medium text-amber-600 dark:text-amber-400">En naranja, el mecanismo</span>: cómo se
          puede mover la estructura sin estirar ni acortar ninguna barra. Las flechas dicen la dirección, no un
          tamaño — un movimiento que no deforma nada no tiene amplitud, y vale lo mismo en el sentido contrario. El
          detalle está más abajo, en los resultados.
        </p>
      )}
      <p className="max-w-3xl text-xs text-muted-foreground">
        Las tablas y la escena son lo mismo mirado de dos formas:{" "}
        <span className="font-medium text-foreground">pasá el mouse por una fila</span> y se enciende acá, o por un
        nudo o una barra de la escena y se enciende la fila. Mientras rotás la vista no se señala nada.
      </p>
    </div>
  );
}
