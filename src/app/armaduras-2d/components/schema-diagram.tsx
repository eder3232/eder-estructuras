"use client";

import { useAtom } from "jotai";

import { SchemaDiagram as GenericSchemaDiagram } from "@/components/custom/diagram-2d/schema-diagram";
import type { DiagramForce, DiagramSupport } from "@/components/custom/diagram-2d/types";
import { useHighlight, useSetHighlight } from "@/components/custom/highlight";
import { NoResults } from "@/components/custom/no-results";
import { atomNodes } from "../store/nodes";
import { atomElements } from "../store/elements";

export function SchemaDiagram() {
  const [nodes] = useAtom(atomNodes);
  const [elements] = useAtom(atomElements);
  // Las dos direcciones de N3, que es lo que hace que el esquema y las tablas
  // sean el mismo objeto mirado de dos formas: lee lo que señalan las filas y
  // señala lo que toca el mouse acá.
  const highlight = useHighlight();
  const setHighlight = useSetHighlight();

  // El diagrama genérico devuelve `null` sin nudos, y la sección quedaba con su
  // título y nada debajo — el mismo agujero que U3 vino a tapar en los
  // resultados, un bloque más arriba. Apareció mirando la captura del estado
  // vacío, no en los tests.
  if (nodes.length === 0) {
    return (
      <NoResults tone="empty" title="Todavía no hay nada que dibujar">
        El esquema aparece en cuanto cargues el primer nudo.
      </NoResults>
    );
  }

  const supports: DiagramSupport[] = nodes
    .filter((n) => n.restrainedX || n.restrainedZ)
    .map((n) => ({ nodeId: n.id, x: n.x, z: n.z, restrainedX: n.restrainedX, restrainedZ: n.restrainedZ }));

  const forces: DiagramForce[] = [];
  for (const n of nodes) {
    if (n.forceX !== 0) forces.push({ nodeId: n.id, x: n.x, z: n.z, axis: "x", value: n.forceX });
    if (n.forceZ !== 0) forces.push({ nodeId: n.id, x: n.x, z: n.z, axis: "z", value: n.forceZ });
  }

  return (
    <div className="flex flex-col gap-2">
      <GenericSchemaDiagram
        nodes={nodes}
        elements={elements}
        supports={supports}
        forces={forces}
        highlight={highlight}
        onHighlight={setHighlight}
      />
      {/* El vínculo no se ve hasta que se prueba, y no hay ningún ícono que lo
          anuncie: se dice una vez, acá, que es donde están las dos mitades a la
          vista. */}
      <p className="max-w-3xl text-xs text-muted-foreground">
        Las tablas y el dibujo son lo mismo mirado de dos formas:{" "}
        <span className="font-medium text-foreground">pasá el mouse por una fila</span> y se enciende acá, o por un
        nudo o una barra del dibujo y se enciende la fila. Una barra prende también los dos nudos que toca.
      </p>
    </div>
  );
}
