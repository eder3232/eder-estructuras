"use client";

import { useAtomValue } from "jotai";

import type { SolveResult } from "@/lib/engine";
import { DeformedDiagram } from "@/components/custom/diagram-2d/deformed-diagram";
import type { DiagramForce } from "@/components/custom/diagram-2d/types";
import type { ElementRow } from "../../store/elements";
import type { NodeRow } from "../../store/nodes";
import { useFrame2DView } from "../../frame2d-view";

interface DeformedShapeProps {
  elements: ElementRow[];
  nodesById: Map<string, NodeRow>;
  solved: SolveResult;
}

export function DeformedShape({ elements, nodesById, solved }: DeformedShapeProps) {
  const { atomMemberShapes } = useFrame2DView();
  const shapes = useAtomValue(atomMemberShapes);
  const nodes = [...nodesById.values()];

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

  // La curva de cada barra en ejes globales: el punto sin deformar a lo largo
  // de la barra, y su desplazamiento (u sobre la barra, v perpendicular) rotado.
  const elementShapes = new Map(
    elements.flatMap((element) => {
      const shape = shapes.get(element.id);
      const from = nodesById.get(element.fromNodeId);
      if (!shape || !from) return [];
      const { cos: c, sin: s } = shape.axis;
      return [
        [
          element.id,
          shape.points.map((p) => ({
            x: from.x + c * p.x,
            z: from.z + s * p.x,
            dx: p.u * c - p.v * s,
            dz: p.u * s + p.v * c,
          })),
        ] as const,
      ];
    }),
  );
  const manual = elements.filter((e) => shapes.get(e.id)?.homogeneousOnly);

  return (
    <DeformedDiagram
      nodes={nodes}
      elements={elements}
      displacements={displacements}
      reactions={reactions}
      elementForceValue={new Map()}
      elementShapes={elementShapes}
      colorByForce={false}
      legend={
        <>
          Línea punteada: forma original. Línea sólida: forma deformada (escalada), con la curva de cada barra entre
          sus nudos: en un empotramiento la barra sale tangente, sin girar, y una barra cargada se flecta aunque sus
          nudos no se muevan. Flechas: reacciones en los apoyos. Los esfuerzos de cada barra están en los diagramas de
          la sección anterior.
          {manual.length > 0 && (
            <>
              {" "}
              {manual.map((e) => e.name).join(", ")} {manual.length === 1 ? "tiene" : "tienen"} el FEM a mano: se
              {manual.length === 1 ? " dibuja" : " dibujan"} solo con lo que hacen sus extremos, sin la flecha propia
              de su carga.
            </>
          )}
        </>
      }
    />
  );
}
